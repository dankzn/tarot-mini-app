import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  HelpCircle,
  Home,
  Lock,
  MessageSquare,
  Paperclip,
  Route,
  Sparkles,
  Target,
  Upload,
  UserCircle,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_TRAINING_PROGRAMS,
  formatTrainingPrice,
  getTrainingProgramCta,
  getTrainingProgramPriceLabel,
  homeworkStatusLabels,
  trainingPaymentLabels,
  trainingStatusLabels,
  type TrainingEnrollment,
  type TrainingGroup,
  type TrainingHomeworkFile,
  type TrainingLesson,
  type TrainingLessonProgress,
  type TrainingProgram,
} from '../lib/training';
import { notifyAdminNewTrainingEnrollment } from '../lib/notifications';

interface TrainingDashboardProps {
  user: any;
  onBackToGateway: () => void;
  onOpenConsultations: () => void;
}

type TrainingTab = 'academy' | 'cabinet';
type EnrollmentKind = 'application' | 'waitlist';

const getSafeDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getGroupPlacesLeft = (group: TrainingGroup) => Math.max((group.capacity || 0) - (group.taken || 0), 0);

const getHomeworkDeadline = (lesson: TrainingLesson, progress?: TrainingLessonProgress) => {
  if (progress?.homework_deadline_extended_until) return getSafeDate(progress.homework_deadline_extended_until);
  const lessonDate = getSafeDate(lesson.lesson_at);
  if (!lessonDate) return null;
  const deadline = new Date(lessonDate);
  deadline.setDate(deadline.getDate() + 2);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
};

const isHomeworkOpen = (lesson: TrainingLesson, progress?: TrainingLessonProgress) => {
  if (progress?.homework_unlocked_by_admin) return true;
  const deadline = getHomeworkDeadline(lesson, progress);
  return Boolean(deadline && Date.now() <= deadline.getTime());
};

const toStorageSegment = (value: unknown, fallback: string) => (
  String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || fallback
);

const getHomeworkStoragePath = (
  userId: unknown,
  enrollmentId: string,
  lessonId: string,
  file: File
) => {
  const extension = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || 'file';
  const randomPart = Math.random().toString(36).slice(2, 10);

  return [
    toStorageSegment(userId, 'student'),
    toStorageSegment(enrollmentId, 'enrollment'),
    toStorageSegment(lessonId, 'lesson'),
    `${Date.now()}-${randomPart}.${extension}`,
  ].join('/');
};

const getLessonVisualState = (lesson: TrainingLesson, progress?: TrainingLessonProgress) => {
  const lessonDate = getSafeDate(lesson.lesson_at);
  const isFuture = lessonDate ? lessonDate.getTime() > Date.now() : true;
  const attended = progress?.attended || progress?.attendance_status === 'attended';

  if (progress?.homework_status === 'accepted') {
    return {
      label: 'ДЗ сдано',
      shell: 'bg-[#E5F1E7] border-[#7EA083]/35',
      badge: 'bg-[#385144] text-white',
    };
  }

  if (attended && !isHomeworkOpen(lesson, progress)) {
    return {
      label: 'ДЗ просрочено',
      shell: 'bg-[#FFF1EC] border-[#B8795C]/35',
      badge: 'bg-[#B8795C] text-white',
    };
  }

  if (attended || progress?.homework_status === 'submitted' || progress?.homework_status === 'revise') {
    return {
      label: progress?.homework_status === 'submitted' ? 'На проверке' : 'ДЗ открыто',
      shell: 'bg-[#FFF8DF] border-[#D8B95A]/35',
      badge: 'bg-[#E9D27A] text-[#385144]',
    };
  }

  if (isFuture) {
    return {
      label: 'Скоро',
      shell: 'bg-[#EEF1EE] border-[#AEB8B0]/25 opacity-75',
      badge: 'bg-white text-[#8A938B]',
    };
  }

  return {
    label: 'Ожидает отметки',
    shell: 'bg-[#F8F3EC] border-white/80',
    badge: 'bg-white text-[#8A938B]',
  };
};

const TRAINING_PATH = [
  { title: 'Диагностика', text: 'Смотрим стартовую точку, темп и формат, чтобы обучение не было “для всех”.' },
  { title: 'Система', text: 'Структура колоды, арканы, вопросы, расклады и понятная логика чтения.' },
  { title: 'Практика', text: 'Домашние задания, разбор ошибок, этика консультаций и уверенность в руках.' },
];

const TRAINING_RESULTS = [
  'читать расклады спокойнее и системнее',
  'понимать связки карт, а не гадать наугад',
  'формулировать вопросы и бережно вести диалог',
  'собрать личный стиль практики без мистического шума',
];

const PROGRAM_PREVIEWS: Record<string, { format: string; level: string; focus: string; access: string }> = {
  'individual-basic': {
    format: '8 занятий + ДЗ',
    level: 'с нуля',
    focus: 'база, колода, простые расклады',
    access: 'подробный план после оплаты',
  },
  'group-basic': {
    format: '8 занятий + ДЗ',
    level: 'с нуля',
    focus: 'база, практика в группе, общий ритм',
    access: 'подробный план после оплаты',
  },
  'individual-advanced': {
    format: '12 занятий + ДЗ',
    level: 'после базы',
    focus: 'связки, сложные запросы, консультация',
    access: 'подробный план после оплаты',
  },
};

const PROGRAM_CURRICULUM: Record<string, Array<{ title: string; focus: string }>> = {
  'individual-basic': [
    { title: 'Введение в Таро и структура колоды', focus: 'Старшие и Младшие арканы, масти, этика и первые правила работы.' },
    { title: 'Старшие арканы', focus: 'Основные жизненные этапы, состояния и важные темы без перегруза символикой.' },
    { title: 'Младшие арканы и масти', focus: 'Жезлы, Кубки, Мечи и Пентакли как сферы жизни и настроение карты.' },
    { title: 'Числовые карты', focus: 'Логика развития ситуации от Туза до Десятки.' },
    { title: 'Придворные карты', focus: 'Люди, роли, поведение, состояние и способ действия.' },
    { title: 'Простые расклады', focus: '1 карта, 3 карты и связный ответ вместо разрозненных значений.' },
    { title: 'Вопросы и ошибки новичков', focus: 'Корректная формулировка вопросов и спокойная работа со сложными картами.' },
    { title: 'Итоговая практика', focus: 'Самостоятельный базовый расклад, разбор ошибок и дальнейший путь.' },
  ],
  'group-basic': [
    { title: 'Введение в Таро и структура колоды', focus: 'Старшие и Младшие арканы, масти, этика и первые правила работы.' },
    { title: 'Старшие арканы', focus: 'Основные жизненные этапы, состояния и важные темы без перегруза символикой.' },
    { title: 'Младшие арканы и масти', focus: 'Жезлы, Кубки, Мечи и Пентакли как сферы жизни и настроение карты.' },
    { title: 'Числовые карты', focus: 'Логика развития ситуации от Туза до Десятки.' },
    { title: 'Придворные карты', focus: 'Люди, роли, поведение, состояние и способ действия.' },
    { title: 'Простые расклады', focus: '1 карта, 3 карты и связный ответ вместо разрозненных значений.' },
    { title: 'Вопросы и ошибки новичков', focus: 'Корректная формулировка вопросов и спокойная работа со сложными картами.' },
    { title: 'Итоговая практика', focus: 'Самостоятельный базовый расклад, разбор ошибок и дальнейший путь.' },
  ],
  'individual-advanced': [
    { title: 'Повтор базы и диагностика уровня', focus: 'Находим слабые места и определяем, что нужно усилить.' },
    { title: 'Старшие арканы глубже', focus: 'Процессы, кризисы, выборы, внутренние состояния и жизненные этапы.' },
    { title: 'Младшие арканы в динамике', focus: 'Развитие ситуации, задержки, конфликт, ресурс и результат.' },
    { title: 'Связки карт', focus: 'Как карты усиливают, смягчают, уточняют или меняют значение друг друга.' },
    { title: 'Придворные карты глубже', focus: 'Люди, роли, стиль общения и внутреннее состояние в конкретном раскладе.' },
    { title: 'Сложные расклады', focus: 'Многоуровневые схемы под запрос, а не один расклад на всё.' },
    { title: 'Отношения и личные запросы', focus: 'Чувства, намерения, конфликт, дистанция и бережная подача результата.' },
    { title: 'Работа, деньги и выбор', focus: 'Варианты действий, риски, ресурсы и сильная стратегия.' },
    { title: 'Сложные карты без страха', focus: 'Мягкая профессиональная трактовка карт, которые часто пугают.' },
    { title: 'Структура консультации', focus: 'Запрос, расклад, чтение карт, выводы, рекомендации и завершение.' },
    { title: 'Практика на реальных запросах', focus: 'Связность речи, глубина трактовки и уточняющие вопросы.' },
    { title: 'Итоговая консультация', focus: 'Полный разбор от начала до конца и персональная обратная связь.' },
  ],
};

const getProgramPreview = (program: TrainingProgram) => (
  PROGRAM_PREVIEWS[program.slug] || {
    format: program.duration_label || 'индивидуальный формат',
    level: program.is_group ? 'группа' : 'лично',
    focus: program.description,
    access: 'подробный план после оплаты',
  }
);

const getProgramCurriculum = (program?: TrainingProgram | null) => (
  program ? PROGRAM_CURRICULUM[program.slug] || [] : []
);

const QUIZ_STEPS = [
  {
    id: 'level',
    title: 'Какой у вас опыт?',
    options: [
      { id: 'new', label: 'Начинаю с нуля' },
      { id: 'base', label: 'Знаю часть арканов' },
      { id: 'practice', label: 'Уже делаю расклады' },
    ],
  },
  {
    id: 'format',
    title: 'Как комфортнее учиться?',
    options: [
      { id: 'personal', label: 'Лично и глубже' },
      { id: 'group', label: 'В группе и с ритмом' },
      { id: 'unsure', label: 'Пока не знаю' },
    ],
  },
  {
    id: 'goal',
    title: 'Что хочется получить?',
    options: [
      { id: 'start', label: 'Спокойный старт' },
      { id: 'system', label: 'Систему и практику' },
      { id: 'deep', label: 'Разбор сложных тем' },
    ],
  },
];

const getProgramTone = (program: TrainingProgram) => {
  if (program.slug.includes('advanced')) {
    return {
      label: 'глубина',
      accent: 'bg-[#8A5A3F] text-white',
      shell: 'border-[#B8795C]/26 bg-[#FFF7EF]',
    };
  }

  if (program.is_group) {
    return {
      label: 'группа',
      accent: 'bg-[#E8DDD1] text-[#385144]',
      shell: 'border-white/80 bg-white/86',
    };
  }

  return {
    label: 'лично',
    accent: 'bg-[#385144] text-white',
    shell: 'border-white/80 bg-white/86',
  };
};

export const TrainingDashboard = ({ user, onBackToGateway, onOpenConsultations }: TrainingDashboardProps) => {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [preferredStart, setPreferredStart] = useState('');
  const [clientComment, setClientComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizRecommendation, setQuizRecommendation] = useState<TrainingProgram | null>(null);
  const [enrollmentKind, setEnrollmentKind] = useState<EnrollmentKind>('application');
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [lessonProgress, setLessonProgress] = useState<TrainingLessonProgress[]>([]);
  const [activeTab, setActiveTab] = useState<TrainingTab>('academy');
  const [selectedLesson, setSelectedLesson] = useState<TrainingLesson | null>(null);
  const [homeworkText, setHomeworkText] = useState('');
  const [homeworkFiles, setHomeworkFiles] = useState<File[]>([]);
  const [submittingHomework, setSubmittingHomework] = useState(false);

  useEffect(() => {
    loadTrainingData();
  }, []);

  const loadTrainingData = async () => {
    try {
      const programsRequest = await supabase
        .from('training_programs')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (programsRequest.error) throw programsRequest.error;

      const activePrograms = programsRequest.data?.length ? programsRequest.data : DEFAULT_TRAINING_PROGRAMS;
      setPrograms(activePrograms);

      const groupsRequest = await supabase
        .from('training_groups')
        .select('*, training_enrollments(id, status)')
        .in('status', ['open', 'full'])
        .order('starts_at', { ascending: true });

      if (!groupsRequest.error) {
        setGroups((groupsRequest.data || []).map((group: any) => ({
          ...group,
          taken: (group.training_enrollments || []).filter((enrollment: any) => enrollment.status !== 'cancelled').length,
        })));
      }

      const enrollmentsRequest = await supabase
        .from('training_enrollments')
        .select('*, training_programs(*), training_groups(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!enrollmentsRequest.error) {
        const loadedEnrollments = enrollmentsRequest.data || [];
        setEnrollments(loadedEnrollments);

        const groupIds = Array.from(new Set(loadedEnrollments.map((enrollment: any) => enrollment.group_id).filter(Boolean)));
        const enrollmentIds = loadedEnrollments.map((enrollment: any) => enrollment.id).filter(Boolean);

        if (groupIds.length > 0) {
          const lessonsRequest = await supabase
            .from('training_lessons')
            .select('*')
            .in('group_id', groupIds)
            .order('sort_order', { ascending: true })
            .order('lesson_at', { ascending: true });

          if (!lessonsRequest.error) setLessons(lessonsRequest.data || []);
        }

        if (enrollmentIds.length > 0) {
          const progressRequest = await supabase
            .from('training_lesson_progress')
            .select('*')
            .in('enrollment_id', enrollmentIds);

          if (!progressRequest.error) setLessonProgress(progressRequest.data || []);
        }
      }
    } catch (error) {
      console.warn('Обучение загружено в витринном режиме:', error);
      setPrograms(DEFAULT_TRAINING_PROGRAMS);
    } finally {
      setLoading(false);
    }
  };

  const activeStudentEnrollment = enrollments.find(enrollment => (
    ['enrolled', 'learning', 'completed'].includes(enrollment.status) && enrollment.group_id
  ));

  useEffect(() => {
    if (activeStudentEnrollment) setActiveTab('cabinet');
  }, [activeStudentEnrollment?.id]);

  const studentLessons = activeStudentEnrollment
    ? lessons.filter(lesson => lesson.group_id === activeStudentEnrollment.group_id)
    : [];

  const getProgressForLesson = (lessonId: string) => (
    lessonProgress.find(progress => (
      progress.lesson_id === lessonId && progress.enrollment_id === activeStudentEnrollment?.id
    ))
  );

  const attendedLessons = studentLessons.filter(lesson => getProgressForLesson(lesson.id)?.attended).length;
  const completedHomeworks = studentLessons.filter(lesson => (
    getProgressForLesson(lesson.id)?.homework_status === 'accepted'
  )).length;
  const learningProgress = studentLessons.length ? Math.round((attendedLessons / studentLessons.length) * 100) : 0;
  const nextLesson = studentLessons.find(lesson => {
    const date = getSafeDate(lesson.lesson_at);
    return date && date.getTime() >= Date.now();
  }) || studentLessons.find(lesson => !getProgressForLesson(lesson.id)?.attended);
  const canViewFullCurriculum = activeStudentEnrollment?.payment_status === 'paid';
  const fallbackCurriculum = getProgramCurriculum(activeStudentEnrollment?.training_programs);
  const pendingHomeworkLessons = studentLessons.filter(lesson => {
    const progress = getProgressForLesson(lesson.id);
    return (
      (progress?.attended || progress?.homework_status === 'assigned' || progress?.homework_status === 'revise') &&
      progress?.homework_status !== 'accepted' &&
      isHomeworkOpen(lesson, progress)
    );
  });
  const overdueHomeworkLessons = studentLessons.filter(lesson => {
    const progress = getProgressForLesson(lesson.id);
    return (
      progress?.attended &&
      progress?.homework_status !== 'accepted' &&
      !isHomeworkOpen(lesson, progress)
    );
  });
  const nextActionLesson = pendingHomeworkLessons[0] || nextLesson;
  const nextActionProgress = nextActionLesson ? getProgressForLesson(nextActionLesson.id) : undefined;
  const nextActionDeadline = nextActionLesson ? getHomeworkDeadline(nextActionLesson, nextActionProgress) : null;

  const openRequests = enrollments.filter(enrollment => !['cancelled', 'completed'].includes(enrollment.status));

  const programGroupsMap = useMemo(() => {
    return programs.reduce<Record<string, TrainingGroup[]>>((acc, program) => {
      acc[program.id] = groups.filter(group => (
        group.program_id === program.id && group.status === 'open' && getGroupPlacesLeft(group) > 0
      ));
      return acc;
    }, {});
  }, [groups, programs]);

  const getProgramGroups = (programId: string) => programGroupsMap[programId] || [];
  const pickProgramBySlug = (slug: string) => programs.find(program => program.slug === slug) || programs[0] || null;

  const getRecommendedProgram = (answers: Record<string, string>) => {
    if (answers.format === 'group') return pickProgramBySlug('group-basic');
    if (answers.level === 'practice' || answers.goal === 'deep') return pickProgramBySlug('individual-advanced');
    if (answers.goal === 'system' && answers.format === 'personal') return pickProgramBySlug('individual-advanced');
    return pickProgramBySlug('individual-basic');
  };

  const handleQuizAnswer = (stepId: string, optionId: string) => {
    const nextAnswers = { ...quizAnswers, [stepId]: optionId };
    setQuizAnswers(nextAnswers);

    if (QUIZ_STEPS.every(step => nextAnswers[step.id])) {
      const recommendation = getRecommendedProgram(nextAnswers);
      setQuizRecommendation(recommendation);
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    }
  };

  const openEnrollment = (program: TrainingProgram, kind: EnrollmentKind = 'application') => {
    const programGroups = getProgramGroups(program.id);
    setSelectedProgram(program);
    setSelectedGroupId(kind === 'waitlist' ? '' : programGroups[0]?.id || '');
    setPreferredStart('');
    setClientComment(kind === 'waitlist' ? 'Хочу попасть в лист ожидания на ближайший поток.' : '');
    setEnrollmentKind(kind);
  };

  const getAdminTelegramIds = async () => {
    const { data } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('role', 'admin')
      .not('telegram_id', 'is', null);

    return (data || []).map((admin: any) => admin.telegram_id).filter(Boolean);
  };

  const submitEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProgram) return;

    setSubmitting(true);

    try {
      const groupId = selectedProgram.is_group ? selectedGroupId || null : null;
      const payload = {
        user_id: user.id,
        program_id: selectedProgram.id,
        group_id: groupId,
        status: 'pending',
        payment_status: 'not_requested',
        final_price: selectedProgram.price,
        certificate_required: Boolean(selectedProgram.has_certificate),
        exam_status: selectedProgram.has_certificate ? 'pending' : 'not_required',
        preferred_start: preferredStart || null,
        client_comment: clientComment || null,
      };

      const { error } = await supabase
        .from('training_enrollments')
        .insert([payload]);

      if (error) throw error;

      const adminTelegramIds = await getAdminTelegramIds();
      await notifyAdminNewTrainingEnrollment(
        adminTelegramIds,
        user.name || 'Клиент',
        user.username || null,
        selectedProgram.title,
        selectedProgram.price,
        selectedProgram.is_group ? groups.find(group => group.id === groupId)?.title || null : null
      );

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      setSelectedProgram(null);
      setSelectedGroupId('');
      setPreferredStart('');
      setClientComment('');
      setEnrollmentKind('application');
      await loadTrainingData();
      alert(enrollmentKind === 'waitlist'
        ? 'Готово: добавил(а) вас в лист ожидания. Я сообщу, когда откроется новый поток.'
        : 'Заявка на обучение отправлена. Я свяжусь с вами и подтвержу детали.'
      );
    } catch (error) {
      console.error('Ошибка заявки на обучение:', error);
      alert(`Не удалось отправить заявку: ${error instanceof Error ? error.message : 'проверьте подключение'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openLessonDetails = (lesson: TrainingLesson) => {
    const progress = getProgressForLesson(lesson.id);
    setSelectedLesson(lesson);
    setHomeworkText(progress?.homework_submitted_text || '');
    setHomeworkFiles([]);
  };

  const submitHomework = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLesson || !activeStudentEnrollment) return;

    const progress = getProgressForLesson(selectedLesson.id);
    if (!isHomeworkOpen(selectedLesson, progress)) {
      alert('Срок сдачи домашнего задания закрыт. Если нужно — админ может открыть сдачу вручную.');
      return;
    }

    setSubmittingHomework(true);

    try {
      const uploadedFiles: TrainingHomeworkFile[] = [];

      for (const file of homeworkFiles) {
        const isAllowed = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ].includes(file.type) || /\.(pdf|docx)$/i.test(file.name);

        if (!isAllowed) {
          throw new Error(`Файл “${file.name}” не подходит. Можно прикрепить только PDF или DOCX.`);
        }

        const path = getHomeworkStoragePath(
          user.id || user.telegram_id,
          activeStudentEnrollment.id,
          selectedLesson.id,
          file
        );
        const { error: uploadError } = await supabase.storage
          .from('training-homework')
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('training-homework')
          .getPublicUrl(path);

        uploadedFiles.push({
          name: file.name,
          path,
          url: publicUrlData.publicUrl,
          size: file.size,
          type: file.type,
        });
      }

      const existingFiles = progress?.homework_files || [];
      const payload = {
        lesson_id: selectedLesson.id,
        enrollment_id: activeStudentEnrollment.id,
        homework_status: 'submitted',
        homework_submitted_text: homeworkText.trim() || null,
        homework_files: [...existingFiles, ...uploadedFiles],
        homework_submitted_at: new Date().toISOString(),
      };

      const request = progress
        ? supabase.from('training_lesson_progress').update(payload).eq('id', progress.id)
        : supabase.from('training_lesson_progress').insert([payload]);

      const { error } = await request;
      if (error) throw error;

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      setSelectedLesson(null);
      setHomeworkText('');
      setHomeworkFiles([]);
      await loadTrainingData();
      alert('Домашнее задание отправлено на проверку.');
    } catch (error) {
      console.error('Ошибка сдачи ДЗ:', error);
      alert(`Не удалось отправить ДЗ: ${error instanceof Error ? error.message : 'ошибка'}`);
    } finally {
      setSubmittingHomework(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F3EC] p-6 text-[#385144]">
        <div className="mx-auto mt-24 max-w-sm rounded-[2rem] bg-white/80 p-6 text-center font-black shadow-sm">
          Загружаю обучение...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_42%,#EFE6DA_100%)] pb-40 text-[#2F463B]">
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToGateway}
            className="flex items-center rounded-2xl bg-white/78 px-4 py-3 text-sm font-black text-[#385144] shadow-sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Выбор
          </button>
          <button
            type="button"
            onClick={onOpenConsultations}
            className="rounded-2xl bg-[#385144] px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(56,81,68,0.16)]"
          >
            Консультации
          </button>
        </div>

        <section className={`mb-5 overflow-hidden bg-[#385144] text-white shadow-[0_22px_48px_rgba(56,81,68,0.22)] ${
          activeTab === 'cabinet' && activeStudentEnrollment ? 'rounded-[1.8rem] p-5' : 'rounded-[2.3rem] p-6'
        }`}>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-[#F4E7C8]">
            {activeTab === 'cabinet' && activeStudentEnrollment ? 'student room' : 'tarot academy'}
          </p>
          <h1 className={`${activeTab === 'cabinet' && activeStudentEnrollment ? 'text-3xl' : 'text-4xl'} font-black leading-none`}>
            {activeTab === 'cabinet' && activeStudentEnrollment ? 'Личный кабинет' : 'Обучение Таро'}
          </h1>
          <p className="mt-4 text-sm font-semibold leading-relaxed text-white/78">
            {activeTab === 'cabinet' && activeStudentEnrollment
              ? 'Здесь курс не теряется: план занятий, посещения, домашки и комментарии собраны в одном месте.'
              : 'Выберите формат обучения: индивидуальный маршрут, расширенная практика или камерная группа.'
            }
          </p>

          {activeTab === 'academy' && (
            <div className="mt-5 grid grid-cols-3 gap-2">
              {['лично', 'группа', 'практика'].map(item => (
                <div key={item} className="rounded-2xl bg-white/12 px-3 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-white/80">
                  {item}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'cabinet' && activeStudentEnrollment && (
            <div className="mt-5 rounded-[1.6rem] bg-white/12 p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-white/58">
                <span>прогресс</span>
                <span>{learningProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/14">
                <div className="h-full rounded-full bg-[#F4E7C8]" style={{ width: `${learningProgress}%` }} />
              </div>
            </div>
          )}
        </section>

        {activeTab === 'academy' && (
          <>
            {activeStudentEnrollment && (
              <button
                type="button"
                onClick={() => setActiveTab('cabinet')}
                className="mb-5 flex w-full items-center justify-between rounded-[1.8rem] border border-white/80 bg-white/86 p-5 text-left shadow-[0_16px_40px_rgba(56,81,68,0.10)]"
              >
                <span>
                  <span className="block text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">вы уже учитесь</span>
                  <span className="mt-1 block text-xl font-black text-[#385144]">
                    {activeStudentEnrollment.training_groups?.title || 'Ваш курс'}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-[#657066]">Открыть план, посещения и домашки</span>
                </span>
                <ChevronRight className="h-6 w-6 text-[#8FA092]" />
              </button>
            )}

            {openRequests.length > 0 && (
              <section className="mb-5 rounded-[1.8rem] border border-white/80 bg-white/82 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.10)]">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">мои заявки</p>
                <div className="space-y-3">
                  {openRequests.slice(0, 2).map(enrollment => (
                    <div key={enrollment.id} className="rounded-2xl bg-[#F8F3EC] p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-[#385144]">{enrollment.training_programs?.title || 'Обучение Таро'}</p>
                          <p className="mt-1 text-xs font-semibold text-[#6C756C]">
                            {trainingPaymentLabels[enrollment.payment_status] || enrollment.payment_status}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#EAF1EA] px-3 py-1 text-xs font-black text-[#385144]">
                          {trainingStatusLabels[enrollment.status] || enrollment.status}
                        </span>
                      </div>
                      <p className="text-xl font-black text-[#8A5A3F]">{formatTrainingPrice(enrollment.final_price)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mb-5 rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.08)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">route first</p>
                  <h2 className="text-2xl font-black text-[#385144]">Сначала — маршрут</h2>
                </div>
                <Route className="h-6 w-6 text-[#B8795C]" />
              </div>
              <div className="grid gap-3">
                {TRAINING_PATH.map((step, index) => (
                  <div key={step.title} className="flex gap-3 rounded-2xl bg-[#F8F3EC] p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#385144] text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-black text-[#385144]">{step.title}</p>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-[#657066]">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowQuiz(true);
                  setQuizAnswers({});
                  setQuizRecommendation(null);
                }}
                className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#385144] py-4 font-black text-white"
              >
                <HelpCircle className="mr-2 h-5 w-5" />
                Подобрать формат
              </button>
            </section>

            <section className="mb-5">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#B8795C]/80">programs</p>
                  <h2 className="text-3xl font-black text-[#385144]">Программы</h2>
                </div>
                <span className="rounded-full bg-white/75 px-4 py-2 text-xs font-black text-[#6C756C]">
                  {programs.length} формата
                </span>
              </div>

              <div className="space-y-3">
                {programs.map(program => {
                  const tone = getProgramTone(program);
                  const preview = getProgramPreview(program);
                  const programGroups = getProgramGroups(program.id);
                  const startsAt = getSafeDate(programGroups[0]?.starts_at);

                  return (
                    <article
                      key={program.id}
                      className={`overflow-hidden rounded-[2rem] border p-5 shadow-[0_16px_40px_rgba(56,81,68,0.10)] ${tone.shell}`}
                    >
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <span className={`mb-3 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tone.accent}`}>
                            {tone.label}
                          </span>
                          <h3 className="text-2xl font-black leading-tight text-[#385144]">{program.title}</h3>
                        </div>
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/76 text-[#385144] shadow-sm">
                          {program.is_group ? <Users className="h-6 w-6" /> : <GraduationCap className="h-6 w-6" />}
                        </div>
                      </div>

                      <p className="mb-4 text-sm font-semibold leading-relaxed text-[#657066]">{program.description}</p>

                      <div className="mb-4 grid grid-cols-3 gap-2">
                        {[
                          { label: 'формат', value: preview.format },
                          { label: 'уровень', value: preview.level },
                          { label: 'фокус', value: preview.focus },
                        ].map(item => (
                          <div key={item.label} className="rounded-2xl bg-white/72 p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A5AEA6]">{item.label}</p>
                            <p className="mt-1 text-[11px] font-black leading-snug text-[#385144]">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mb-4 grid grid-cols-[1fr_auto] gap-3">
                        <div className="rounded-2xl bg-white/76 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9AA39B]">стоимость</p>
                          <p className="mt-1 text-2xl font-black text-[#8A5A3F]">{getTrainingProgramPriceLabel(program)}</p>
                        </div>
                        <div className="rounded-2xl bg-white/76 p-4 text-right">
                          <Clock className="ml-auto mb-2 h-4 w-4 text-[#8A9B7B]" />
                          <p className="max-w-[88px] text-xs font-black leading-tight text-[#6C756C]">{program.duration_label}</p>
                        </div>
                      </div>

                      <div className="mb-4 flex flex-wrap gap-2">
                        {(program.includes || []).slice(0, 3).map(item => (
                          <span key={item} className="rounded-full bg-white/76 px-3 py-2 text-xs font-black text-[#385144]">
                            {item}
                          </span>
                        ))}
                      </div>

                      <div className="mb-4 rounded-2xl border border-dashed border-[#B8795C]/30 bg-white/54 p-3 text-xs font-black leading-relaxed text-[#8A5A3F]">
                        {preview.access}: занятия, домашние задания и разборы появятся в личном кабинете студента.
                      </div>

                      {program.is_group && (
                        <div className="mb-4 rounded-2xl border border-dashed border-[#B8795C]/35 bg-[#FFF9F0] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B8795C]">ближайший поток</p>
                          {programGroups.length > 0 ? (
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <div>
                                <p className="font-black text-[#385144]">{programGroups[0].title}</p>
                                <p className="text-xs font-semibold text-[#6C756C]">
                                  {startsAt ? format(startsAt, 'd MMMM, HH:mm', { locale: ru }) : 'Дата уточняется'}
                                </p>
                              </div>
                              <span className="rounded-full bg-[#EAF1EA] px-3 py-1 text-xs font-black text-[#385144]">
                                {getGroupPlacesLeft(programGroups[0])} мест
                              </span>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm font-semibold text-[#6C756C]">Набор скоро откроется. Можно оставить заявку заранее.</p>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => openEnrollment(program, program.is_group && programGroups.length === 0 ? 'waitlist' : 'application')}
                        className="flex w-full items-center justify-center rounded-2xl bg-[#385144] py-4 font-black text-white shadow-[0_14px_32px_rgba(56,81,68,0.18)]"
                      >
                        {getTrainingProgramCta(program, programGroups.length > 0)}
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.08)]">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">result</p>
              <h2 className="mb-4 flex items-center text-2xl font-black text-[#385144]">
                <Target className="mr-2 h-6 w-6 text-[#B8795C]" />
                После обучения
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {TRAINING_RESULTS.map(result => (
                  <div key={result} className="flex items-start rounded-2xl bg-[#F8F3EC] p-3 text-sm font-black text-[#385144]">
                    <Check className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[#B8795C]" />
                    {result}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'cabinet' && activeStudentEnrollment && (
          <section className="space-y-4">
            <div className="rounded-[2rem] border border-white/80 bg-white/88 p-5 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">ваш курс</p>
                  <h2 className="mt-1 text-2xl font-black leading-tight text-[#385144]">
                    {activeStudentEnrollment.training_groups?.title || activeStudentEnrollment.training_programs?.title || 'Обучение Таро'}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#657066]">
                    {activeStudentEnrollment.training_programs?.title || 'Учебная программа'}
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1EA] text-[#385144]">
                  <GraduationCap className="h-6 w-6" />
                </div>
              </div>

              <div className="mb-4 rounded-[1.35rem] bg-[#F8F3EC] p-4">
                <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-[#8FA092]">
                  <span>прогресс курса</span>
                  <span>{learningProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#E2DDD4]">
                  <div className="h-full rounded-full bg-[#385144]" style={{ width: `${learningProgress}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'уроков', value: studentLessons.length },
                  { label: 'был(а)', value: attendedLessons },
                  { label: 'дз принято', value: completedHomeworks },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl bg-white p-3 text-center shadow-sm">
                    <p className="text-2xl font-black text-[#385144]">{item.value}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8FA092]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!nextActionLesson}
              onClick={() => nextActionLesson && openLessonDetails(nextActionLesson)}
              className="w-full overflow-hidden rounded-[2rem] bg-[#385144] p-5 text-left text-white shadow-[0_18px_44px_rgba(56,81,68,0.18)] transition active:scale-[0.99] disabled:opacity-80"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#F4E7C8]/80">
                  {pendingHomeworkLessons.length > 0 ? 'нужно сдать' : 'ближайший шаг'}
                </p>
                <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-black text-white">
                  {pendingHomeworkLessons.length > 0 ? `${pendingHomeworkLessons.length} ДЗ` : 'Открыть'}
                </span>
              </div>
              {nextActionLesson ? (
                <>
                  <h3 className="text-2xl font-black leading-tight">{nextActionLesson.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-white/72">
                    {getSafeDate(nextActionLesson.lesson_at)
                      ? format(getSafeDate(nextActionLesson.lesson_at)!, 'd MMMM, HH:mm', { locale: ru })
                      : 'Дата появится после настройки расписания'
                    }
                  </p>
                  {(nextActionLesson.homework_title || nextActionLesson.homework_description) && (
                    <div className="mt-4 rounded-[1.35rem] bg-white/12 p-4">
                      <p className="text-sm font-black">ДЗ: {nextActionLesson.homework_title || 'Домашняя работа'}</p>
                      {nextActionDeadline && nextActionProgress?.homework_status !== 'accepted' && (
                        <p className="mt-2 text-xs font-black text-[#F4E7C8]">
                          Сдать до {format(nextActionDeadline, 'd MMMM, HH:mm', { locale: ru })}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm font-semibold leading-relaxed text-white/72">
                  План появится здесь после добавления занятий в админке.
                </p>
              )}
            </button>

            {(pendingHomeworkLessons.length > 0 || overdueHomeworkLessons.length > 0) && (
              <div className="rounded-[2rem] border border-white/80 bg-white/88 p-5 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">homework</p>
                    <h2 className="text-2xl font-black text-[#385144]">Домашки</h2>
                  </div>
                  <FileText className="h-6 w-6 text-[#B8795C]" />
                </div>
                <div className="space-y-2">
                  {[...pendingHomeworkLessons, ...overdueHomeworkLessons].slice(0, 3).map(lesson => {
                    const progress = getProgressForLesson(lesson.id);
                    const deadline = getHomeworkDeadline(lesson, progress);
                    const isOverdue = progress?.attended && progress?.homework_status !== 'accepted' && !isHomeworkOpen(lesson, progress);

                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => openLessonDetails(lesson)}
                        className={`w-full rounded-[1.25rem] p-4 text-left transition active:scale-[0.99] ${
                          isOverdue ? 'bg-[#FFF1EC]' : 'bg-[#F8F3EC]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-[#385144]">{lesson.homework_title || lesson.title}</p>
                            {deadline && (
                              <p className={`mt-1 text-xs font-black ${isOverdue ? 'text-[#B8795C]' : 'text-[#8A5A3F]'}`}>
                                {isOverdue ? 'Срок закрыт' : 'До'} {format(deadline, 'd MMMM, HH:mm', { locale: ru })}
                              </p>
                            )}
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black ${
                            isOverdue ? 'bg-[#B8795C] text-white' : 'bg-white text-[#385144]'
                          }`}>
                            {isOverdue ? 'просрочено' : homeworkStatusLabels[progress?.homework_status || 'not_started']}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-[2rem] border border-white/80 bg-white/88 p-5 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">course timeline</p>
                  <h2 className="text-2xl font-black text-[#385144]">План курса</h2>
                </div>
                <Route className="h-6 w-6 text-[#B8795C]" />
              </div>

              {!canViewFullCurriculum ? (
                <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4">
                  <p className="text-sm font-black text-[#385144]">Подробная программа откроется после оплаты</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6C756C]">
                    После подтверждения оплаты здесь появятся занятия, ДЗ и разборы.
                  </p>
                </div>
              ) : studentLessons.length === 0 && fallbackCurriculum.length > 0 ? (
                <div className="space-y-2">
                  {fallbackCurriculum.map((lesson, index) => (
                    <div key={lesson.title} className="flex gap-3 rounded-[1.25rem] bg-[#F8F3EC] p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-[#385144]">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-black text-[#385144]">{lesson.title}</h3>
                        <p className="mt-1 text-xs font-semibold leading-relaxed text-[#657066]">{lesson.focus}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : studentLessons.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4 text-sm font-semibold text-[#6C756C]">
                  Пока занятий нет. Когда админ добавит план, он сразу появится здесь.
                </div>
              ) : (
                <div className="space-y-2">
                  {studentLessons.map((lesson, index) => {
                    const progress = getProgressForLesson(lesson.id);
                    const lessonDate = getSafeDate(lesson.lesson_at);
                    const visualState = getLessonVisualState(lesson, progress);
                    const isAccepted = progress?.homework_status === 'accepted';

                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => openLessonDetails(lesson)}
                        className={`flex w-full items-center gap-3 rounded-[1.25rem] border p-3 text-left transition active:scale-[0.99] ${visualState.shell}`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          isAccepted ? 'bg-[#385144] text-white' : 'bg-white text-[#385144]'
                        }`}>
                          {isAccepted ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-black text-[#385144]">{lesson.title}</h3>
                          </div>
                          <p className="mt-1 text-xs font-bold text-[#6C756C]">
                            {lessonDate ? format(lessonDate, 'd MMMM, HH:mm', { locale: ru }) : 'без даты'}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${visualState.badge}`}>
                          {visualState.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2 rounded-[1.8rem] border border-white/80 bg-white/92 p-2 shadow-[0_18px_46px_rgba(56,81,68,0.18)] backdrop-blur">
          <button
            type="button"
            onClick={() => setActiveTab('academy')}
            className={`flex flex-col items-center justify-center rounded-[1.3rem] px-3 py-3 text-xs font-black transition ${
              activeTab === 'academy' ? 'bg-[#385144] text-white' : 'text-[#6C756C]'
            }`}
          >
            <Home className="mb-1 h-5 w-5" />
            Академия
          </button>
          <button
            type="button"
            disabled={!activeStudentEnrollment}
            onClick={() => activeStudentEnrollment && setActiveTab('cabinet')}
            className={`flex flex-col items-center justify-center rounded-[1.3rem] px-3 py-3 text-xs font-black transition ${
              activeTab === 'cabinet'
                ? 'bg-[#385144] text-white'
                : activeStudentEnrollment
                  ? 'text-[#6C756C]'
                  : 'text-[#A9B0AA] opacity-60'
            }`}
          >
            <UserCircle className="mb-1 h-5 w-5" />
            ЛК
          </button>
          <button
            type="button"
            onClick={onOpenConsultations}
            className="flex flex-col items-center justify-center rounded-[1.3rem] px-3 py-3 text-xs font-black text-[#6C756C] transition"
          >
            <CalendarCheck className="mb-1 h-5 w-5" />
            Консультации
          </button>
        </div>
      </div>

      {selectedLesson && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/42 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitHomework}
            className="mx-auto max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-[#F8F3EC] p-5 shadow-2xl"
          >
            {(() => {
              const progress = getProgressForLesson(selectedLesson.id);
              const deadline = getHomeworkDeadline(selectedLesson, progress);
              const homeworkOpen = isHomeworkOpen(selectedLesson, progress);
              const files = progress?.homework_files || [];

              return (
                <>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]">урок</p>
                      <h3 className="mt-1 text-2xl font-black text-[#385144]">{selectedLesson.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLesson(null)}
                      className="rounded-2xl bg-white px-4 py-2 font-black text-[#385144]"
                    >
                      ×
                    </button>
                  </div>

                  {selectedLesson.description && (
                    <p className="mb-4 rounded-2xl bg-white/78 p-4 text-sm font-semibold leading-relaxed text-[#657066]">
                      {selectedLesson.description}
                    </p>
                  )}

                  <div className="mb-4 rounded-2xl bg-white/78 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-[#385144]">{selectedLesson.homework_title || 'Домашняя работа'}</p>
                      <span className="rounded-full bg-[#EAF1EA] px-3 py-1 text-[10px] font-black text-[#385144]">
                        {homeworkStatusLabels[progress?.homework_status || 'not_started']}
                      </span>
                    </div>
                    {selectedLesson.homework_description && (
                      <p className="text-sm font-semibold leading-relaxed text-[#657066]">{selectedLesson.homework_description}</p>
                    )}
                    {deadline && (
                      <p className={`mt-3 text-xs font-black ${homeworkOpen ? 'text-[#8A5A3F]' : 'text-[#B8795C]'}`}>
                        {homeworkOpen ? 'Сдать до' : 'Срок сдачи закрыт'}: {format(deadline, 'd MMMM, HH:mm', { locale: ru })}
                      </p>
                    )}
                  </div>

                  {files.length > 0 && (
                    <div className="mb-4 rounded-2xl bg-white/78 p-4">
                      <p className="mb-2 text-sm font-black text-[#385144]">Отправленные файлы</p>
                      <div className="space-y-2">
                        {files.map(file => (
                          <a
                            key={file.path}
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center rounded-xl bg-[#F8F3EC] p-3 text-sm font-bold text-[#385144]"
                          >
                            <FileText className="mr-2 h-4 w-4 shrink-0" />
                            {file.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {homeworkOpen && progress?.homework_status !== 'accepted' ? (
                    <>
                      <textarea
                        value={homeworkText}
                        onChange={(event) => setHomeworkText(event.target.value)}
                        className="mb-3 min-h-32 w-full rounded-2xl border border-[#385144]/10 bg-white p-4 font-semibold text-[#385144]"
                        placeholder="Напишите ответ по домашнему заданию..."
                      />
                      <label className="mb-4 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[#385144]/25 bg-white/78 p-4 text-sm font-black text-[#385144]">
                        <Paperclip className="mr-2 h-4 w-4" />
                        PDF или DOCX
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="hidden"
                          onChange={(event) => setHomeworkFiles(Array.from(event.target.files || []))}
                        />
                      </label>
                      {homeworkFiles.length > 0 && (
                        <div className="mb-4 rounded-2xl bg-white/70 p-3 text-xs font-bold text-[#6C756C]">
                          {homeworkFiles.map(file => file.name).join(', ')}
                        </div>
                      )}
                      <button
                        disabled={submittingHomework}
                        className="flex w-full items-center justify-center rounded-2xl bg-[#385144] py-4 font-black text-white disabled:opacity-60"
                      >
                        <Upload className="mr-2 h-5 w-5" />
                        {submittingHomework ? 'Отправка...' : 'Сдать домашнее задание'}
                      </button>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4 text-sm font-semibold leading-relaxed text-[#6C756C]">
                      <Lock className="mb-2 h-5 w-5 text-[#B8795C]" />
                      {progress?.homework_status === 'accepted'
                        ? 'Домашнее задание принято. Повторная сдача не нужна.'
                        : 'Сдача закрыта. Если нужна пересдача, админ может открыть доступ вручную.'
                      }
                    </div>
                  )}
                </>
              );
            })()}
          </form>
        </div>
      )}

      {selectedProgram && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/42 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitEnrollment}
            className="mx-auto max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-[#F8F3EC] p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]">
                  {enrollmentKind === 'waitlist' ? 'лист ожидания' : 'заявка на обучение'}
                </p>
                <h3 className="mt-1 text-2xl font-black text-[#385144]">{selectedProgram.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProgram(null)}
                className="rounded-2xl bg-white px-4 py-2 font-black text-[#385144]"
              >
                ×
              </button>
            </div>

            <p className="mb-4 rounded-2xl bg-white/78 p-4 text-sm font-semibold leading-relaxed text-[#657066]">
              {selectedProgram.description}
            </p>

            {selectedProgram.is_group && getProgramGroups(selectedProgram.id).length > 0 && (
              <div className="mb-3">
                <label className="mb-1 block text-sm font-black text-[#385144]">Группа</label>
                <select
                  value={selectedGroupId}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                  className="w-full rounded-2xl border border-[#385144]/10 bg-white p-4 font-bold text-[#385144]"
                >
                  {getProgramGroups(selectedProgram.id).map(group => {
                    const startsAt = getSafeDate(group.starts_at);
                    return (
                      <option key={group.id} value={group.id}>
                        {group.title} · {startsAt ? format(startsAt, 'd MMMM', { locale: ru }) : 'дата уточняется'} · мест: {getGroupPlacesLeft(group)}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className="mb-1 block text-sm font-black text-[#385144]">Когда удобно начать?</label>
              <input
                value={preferredStart}
                onChange={(event) => setPreferredStart(event.target.value)}
                className="w-full rounded-2xl border border-[#385144]/10 bg-white p-4 font-bold text-[#385144]"
                placeholder="Например: в июле, по вечерам"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 flex items-center text-sm font-black text-[#385144]">
                <MessageSquare className="mr-2 h-4 w-4" />
                Комментарий
              </label>
              <textarea
                value={clientComment}
                onChange={(event) => setClientComment(event.target.value)}
                className="min-h-24 w-full rounded-2xl border border-[#385144]/10 bg-white p-4 font-bold text-[#385144]"
                placeholder="Расскажите, какой опыт уже есть и что хочется получить от обучения"
              />
            </div>

            <div className="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3">
              <span className="font-black text-[#385144]">Стоимость</span>
              <span className="text-xl font-black text-[#8A5A3F]">{getTrainingProgramPriceLabel(selectedProgram)}</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center rounded-2xl bg-[#385144] py-4 font-black text-white disabled:opacity-60"
            >
              {submitting ? 'Отправляю...' : enrollmentKind === 'waitlist' ? 'Встать в лист ожидания' : 'Отправить заявку'}
              {!submitting && <Sparkles className="ml-2 h-5 w-5 text-[#F4E7C8]" />}
            </button>
          </form>
        </div>
      )}

      {showQuiz && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/42 p-4 backdrop-blur-sm">
          <div className="mx-auto max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-[#F8F3EC] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]">academy quiz</p>
                <h3 className="mt-1 text-2xl font-black text-[#385144]">Подберём маршрут</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuiz(false)}
                className="rounded-2xl bg-white px-4 py-2 font-black text-[#385144]"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {QUIZ_STEPS.map(step => (
                <div key={step.id} className="rounded-[1.4rem] bg-white/80 p-4">
                  <p className="mb-3 font-black text-[#385144]">{step.title}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {step.options.map(option => {
                      const selected = quizAnswers[step.id] === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleQuizAnswer(step.id, option.id)}
                          className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                            selected ? 'bg-[#385144] text-white' : 'bg-[#F8F3EC] text-[#385144]'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {quizRecommendation && (
              <div className="mt-4 rounded-[1.5rem] bg-[#385144] p-5 text-white">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F4E7C8]">рекомендация</p>
                <h4 className="mt-2 text-2xl font-black">{quizRecommendation.title}</h4>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-white/75">{quizRecommendation.description}</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuiz(false);
                    openEnrollment(
                      quizRecommendation,
                      quizRecommendation.is_group && getProgramGroups(quizRecommendation.id).length === 0 ? 'waitlist' : 'application'
                    );
                  }}
                  className="mt-4 w-full rounded-2xl bg-white py-3 font-black text-[#385144]"
                >
                  {getTrainingProgramCta(quizRecommendation, getProgramGroups(quizRecommendation.id).length > 0)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
