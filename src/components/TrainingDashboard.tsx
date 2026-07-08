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
  GraduationCap,
  HelpCircle,
  Home,
  MessageSquare,
  Route,
  Sparkles,
  Target,
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_42%,#EFE6DA_100%)] pb-28 text-[#2F463B]">
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

        <section className="mb-5 overflow-hidden rounded-[2.3rem] bg-[#385144] p-6 text-white shadow-[0_22px_48px_rgba(56,81,68,0.22)]">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-[#F4E7C8]">
            {activeTab === 'cabinet' && activeStudentEnrollment ? 'student room' : 'tarot academy'}
          </p>
          <h1 className="text-4xl font-black leading-none">
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
          <section className="space-y-5">
            <div className="rounded-[2rem] border border-white/80 bg-white/86 p-5 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">ваш курс</p>
                  <h2 className="mt-1 text-2xl font-black text-[#385144]">
                    {activeStudentEnrollment.training_groups?.title || activeStudentEnrollment.training_programs?.title || 'Обучение Таро'}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#657066]">
                    {trainingStatusLabels[activeStudentEnrollment.status] || activeStudentEnrollment.status}
                  </p>
                </div>
                <GraduationCap className="h-8 w-8 text-[#B8795C]" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Занятий', value: studentLessons.length },
                  { label: 'Посещено', value: attendedLessons },
                  { label: 'ДЗ принято', value: completedHomeworks },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl bg-[#F8F3EC] p-3 text-center">
                    <p className="text-2xl font-black text-[#385144]">{item.value}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8FA092]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] bg-[#385144] p-5 text-white shadow-[0_18px_44px_rgba(56,81,68,0.18)]">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F4E7C8]/80">ближайший шаг</p>
              {nextLesson ? (
                <>
                  <h3 className="mt-2 text-2xl font-black">{nextLesson.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-white/72">
                    {getSafeDate(nextLesson.lesson_at)
                      ? format(getSafeDate(nextLesson.lesson_at)!, 'd MMMM, HH:mm', { locale: ru })
                      : 'Дата появится после настройки расписания'
                    }
                  </p>
                  {nextLesson.homework_title && (
                    <p className="mt-3 rounded-2xl bg-white/12 p-3 text-sm font-black text-white">
                      ДЗ: {nextLesson.homework_title}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm font-semibold leading-relaxed text-white/72">
                  План появится здесь после добавления занятий в админке.
                </p>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/80 bg-white/86 p-5 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
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
                    Пока виден только общий маршрут обучения. После подтверждения оплаты здесь появятся занятия, домашние задания и разборы.
                  </p>
                </div>
              ) : studentLessons.length === 0 && fallbackCurriculum.length > 0 ? (
                <div className="space-y-3">
                  {fallbackCurriculum.map((lesson, index) => (
                    <div key={lesson.title} className="rounded-[1.45rem] bg-[#F8F3EC] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#B8795C]">Занятие {index + 1}</p>
                      <h3 className="mt-1 font-black text-[#385144]">{lesson.title}</h3>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#657066]">{lesson.focus}</p>
                    </div>
                  ))}
                </div>
              ) : studentLessons.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4 text-sm font-semibold text-[#6C756C]">
                  Пока занятий нет. Когда админ добавит план, он сразу появится здесь: темы, даты, домашки и статусы.
                </div>
              ) : (
                <div className="space-y-3">
                  {studentLessons.map((lesson, index) => {
                    const progress = getProgressForLesson(lesson.id);
                    const lessonDate = getSafeDate(lesson.lesson_at);

                    return (
                      <div key={lesson.id} className="relative rounded-[1.45rem] bg-[#F8F3EC] p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#B8795C]">Занятие {index + 1}</p>
                            <h3 className="mt-1 font-black text-[#385144]">{lesson.title}</h3>
                            {lessonDate && (
                              <p className="mt-1 text-xs font-bold text-[#6C756C]">
                                {format(lessonDate, 'd MMMM, HH:mm', { locale: ru })}
                              </p>
                            )}
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${
                            progress?.attended ? 'bg-[#DDE9E0] text-[#385144]' : 'bg-white text-[#8FA092]'
                          }`}>
                            {progress?.attended ? 'Посещено' : 'Ожидает'}
                          </span>
                        </div>

                        {lesson.description && (
                          <p className="mb-3 text-sm font-semibold leading-relaxed text-[#657066]">{lesson.description}</p>
                        )}

                        {(lesson.homework_title || lesson.homework_description) && (
                          <div className="rounded-2xl bg-white/80 p-3">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="text-sm font-black text-[#385144]">{lesson.homework_title || 'Домашняя работа'}</p>
                              <span className="rounded-full bg-[#EAF1EA] px-2 py-1 text-[10px] font-black text-[#385144]">
                                {homeworkStatusLabels[progress?.homework_status || 'not_started']}
                              </span>
                            </div>
                            {lesson.homework_description && (
                              <p className="text-xs font-semibold leading-relaxed text-[#6C756C]">{lesson.homework_description}</p>
                            )}
                            {progress?.homework_status === 'accepted' && (
                              <p className="mt-2 flex items-center text-xs font-black text-[#385144]">
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Домашняя работа принята
                              </p>
                            )}
                            {progress?.homework_note && (
                              <p className="mt-2 rounded-xl bg-[#F8F3EC] p-2 text-xs font-semibold leading-relaxed text-[#657066]">
                                Комментарий: {progress.homework_note}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
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
