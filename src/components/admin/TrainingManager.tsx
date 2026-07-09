import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { BookOpen, CalendarDays, CheckCircle2, GraduationCap, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  DEFAULT_TRAINING_PROGRAMS,
  formatTrainingPrice,
  getTrainingProgramPriceLabel,
  trainingGroupStatusLabels,
  homeworkStatusLabels,
  trainingPaymentLabels,
  trainingStatusLabels,
  type TrainingEnrollment,
  type TrainingGroup,
  type TrainingLesson,
  type TrainingLessonProgress,
  type TrainingProgram,
} from '../../lib/training';

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const fromDateTimeLocal = (value: string) => (value ? new Date(value).toISOString() : null);

const getDefaultStart = () => {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setHours(19, 0, 0, 0);
  return toDateTimeLocal(date.toISOString());
};

const getSafeDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getHomeworkDeadline = (lesson: TrainingLesson, progress?: TrainingLessonProgress) => {
  if (progress?.homework_deadline_extended_until) return getSafeDate(progress.homework_deadline_extended_until);
  const lessonDate = getSafeDate(lesson.lesson_at);
  if (!lessonDate) return null;
  const deadline = new Date(lessonDate);
  deadline.setDate(deadline.getDate() + 2);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
};

const getJournalCellValue = (progress?: TrainingLessonProgress) => {
  if (!progress) return '';
  if (progress.attendance_status === 'absent' || (!progress.attended && progress.attendance_status === 'absent')) return 'absent';
  if (progress.grade) return String(progress.grade);
  if (progress.attended || progress.attendance_status === 'attended') return 'attended';
  return '';
};

const groupStatuses = ['open', 'full', 'closed', 'started', 'completed'];
const enrollmentRouteStatuses = ['pending', 'details', 'contract', 'enrolled', 'learning', 'completed'];
const paymentStatuses = ['not_requested', 'requested', 'marked_paid', 'paid'];
const homeworkStatuses = ['not_started', 'assigned', 'submitted', 'accepted', 'revise'];
const activeStudentStatuses = ['enrolled', 'learning', 'completed'];

type AdminTrainingSection = 'enrollments' | 'programs' | 'groups' | 'journal';

const TRAINING_LESSON_TEMPLATES: Record<string, Array<{ title: string; homework: string }>> = {
  'individual-basic': [
    { title: 'Введение в Таро и структура колоды', homework: 'Познакомиться с колодой и сделать расклад на 1 карту на день' },
    { title: 'Старшие арканы', homework: 'Описать 5 Старших арканов своими словами' },
    { title: 'Младшие арканы и масти', homework: 'Разобрать масти через эмоции, ситуации и примеры' },
    { title: 'Числовые карты', homework: 'Сделать 3 расклада “ситуация — совет — итог”' },
    { title: 'Придворные карты', homework: 'Подобрать примеры людей/ролей к придворным картам' },
    { title: 'Простые расклады', homework: 'Сделать 3 расклада на состояние, выбор и ближайшую ситуацию' },
    { title: 'Формулировка вопросов и ошибки новичков', homework: 'Переформулировать 10 вопросов и сделать расклад по одному из них' },
    { title: 'Итоговая практика', homework: 'Итоговый самостоятельный расклад с письменной трактовкой' },
  ],
  'group-basic': [
    { title: 'Введение в Таро и структура колоды', homework: 'Познакомиться с колодой и сделать расклад на 1 карту на день' },
    { title: 'Старшие арканы', homework: 'Описать 5 Старших арканов своими словами' },
    { title: 'Младшие арканы и масти', homework: 'Разобрать масти через эмоции, ситуации и примеры' },
    { title: 'Числовые карты', homework: 'Сделать 3 расклада “ситуация — совет — итог”' },
    { title: 'Придворные карты', homework: 'Подобрать примеры людей/ролей к придворным картам' },
    { title: 'Простые расклады', homework: 'Сделать 3 расклада на состояние, выбор и ближайшую ситуацию' },
    { title: 'Формулировка вопросов и ошибки новичков', homework: 'Переформулировать 10 вопросов и сделать расклад по одному из них' },
    { title: 'Итоговая практика', homework: 'Итоговый самостоятельный расклад с письменной трактовкой' },
  ],
  'individual-advanced': [
    { title: 'Повтор базы и диагностика уровня', homework: 'Сделать диагностический расклад и объяснить каждую карту в позиции' },
    { title: 'Старшие арканы глубже', homework: 'Разобрать 3 Старших аркана на уровнях событие, состояние, совет, риск' },
    { title: 'Младшие арканы в динамике', homework: 'Описать динамику ситуации от первой карты к последней' },
    { title: 'Связки карт', homework: 'Разобрать 10 связок из двух карт и 5 связок из трёх карт' },
    { title: 'Придворные карты глубже', homework: 'Сделать расклад на взаимодействие двух людей и определить роли' },
    { title: 'Сложные расклады', homework: 'Составить схему расклада под конкретный вопрос' },
    { title: 'Отношения и личные запросы', homework: 'Сделать расклад на отношения и прописать бережную подачу результата' },
    { title: 'Работа, деньги и выбор', homework: 'Сделать расклад на выбор из двух вариантов' },
    { title: 'Сложные карты без страха', homework: 'Написать мягкие трактовки для 5 сложных карт' },
    { title: 'Структура консультации', homework: 'Подготовить письменный сценарий консультации' },
    { title: 'Практика на реальных запросах', homework: 'Провести тренировочный расклад и оформить его как консультацию' },
    { title: 'Итоговая консультация', homework: 'Финальная письменная работа: расклад, трактовка, выводы и рекомендации' },
  ],
};

const createEmptyProgramForm = () => ({
  id: '',
  slug: '',
  title: '',
  format_type: 'individual',
  description: '',
  price: 0,
  duration_label: '',
  includes_text: '',
  is_group: false,
  is_active: true,
  has_certificate: false,
  sort_order: 100,
});

export const TrainingManager = () => {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [lessonProgress, setLessonProgress] = useState<TrainingLessonProgress[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState('');
  const [activeSection, setActiveSection] = useState<AdminTrainingSection>('enrollments');
  const [isProgramEditorOpen, setProgramEditorOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<TrainingLesson | null>(null);
  const [programForm, setProgramForm] = useState(createEmptyProgramForm());
  const [groupForm, setGroupForm] = useState({
    program_id: '',
    title: '',
    starts_at: getDefaultStart(),
    capacity: 6,
    notes: '',
  });
  const [lessonForm, setLessonForm] = useState({
    group_id: '',
    title: '',
    lesson_at: '',
    description: '',
    homework_title: '',
    homework_description: '',
    sort_order: 1,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadWarning('');

    try {
      const { data: programsData, error: programsError } = await supabase
        .from('training_programs')
        .select('*')
        .order('sort_order', { ascending: true });

      if (programsError) throw programsError;

      const loadedPrograms = programsData?.length ? programsData : DEFAULT_TRAINING_PROGRAMS;
      setPrograms(loadedPrograms);

      const firstGroupProgram = loadedPrograms.find(program => program.is_group);
      setGroupForm(current => ({
        ...current,
        program_id: current.program_id || firstGroupProgram?.id || loadedPrograms[0]?.id || '',
      }));

      const { data: groupsData, error: groupsError } = await supabase
        .from('training_groups')
        .select('*, training_enrollments(id, status)')
        .order('starts_at', { ascending: true });

      if (groupsError) throw groupsError;

      const loadedGroups = (groupsData || []).map((group: any) => ({
        ...group,
        taken: (group.training_enrollments || []).filter((enrollment: any) => enrollment.status !== 'cancelled').length,
      }));

      setGroups(loadedGroups);
      setSelectedGroupId(current => current || loadedGroups[0]?.id || '');
      setLessonForm(current => ({
        ...current,
        group_id: current.group_id || loadedGroups[0]?.id || '',
      }));

      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('training_enrollments')
        .select('*, users(name, username, telegram_id), training_programs(*), training_groups(*)')
        .order('created_at', { ascending: false });

      if (enrollmentsError) throw enrollmentsError;

      setEnrollments(enrollmentsData || []);

      const { data: lessonsData, error: lessonsError } = await supabase
        .from('training_lessons')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('lesson_at', { ascending: true });

      if (!lessonsError) setLessons(lessonsData || []);

      const { data: progressData, error: progressError } = await supabase
        .from('training_lesson_progress')
        .select('*');

      if (!progressError) setLessonProgress(progressData || []);
    } catch (error) {
      console.error('Ошибка загрузки обучения:', error);
      setPrograms(DEFAULT_TRAINING_PROGRAMS);
      setLoadWarning('Модуль обучения временно загружен в витринном режиме. Проверьте подключение к базе данных.');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const activeGroups = groups.filter(group => ['open', 'full'].includes(group.status)).length;
    const pending = enrollments.filter(enrollment => ['pending', 'details', 'contract'].includes(enrollment.status)).length;
    const enrolled = enrollments.filter(enrollment => activeStudentStatuses.includes(enrollment.status)).length;
    const money = enrollments
      .filter(enrollment => ['requested', 'marked_paid'].includes(enrollment.payment_status))
      .reduce((sum, enrollment) => sum + (enrollment.final_price || 0), 0);

    return { activeGroups, pending, enrolled, money };
  }, [groups, enrollments]);

  const selectedGroup = groups.find(group => group.id === selectedGroupId) || groups[0] || null;
  const selectedGroupLessons = selectedGroup
    ? lessons.filter(lesson => lesson.group_id === selectedGroup.id)
    : [];
  const selectedGroupStudents = selectedGroup
    ? enrollments.filter(enrollment => (
      enrollment.group_id === selectedGroup.id && activeStudentStatuses.includes(enrollment.status)
    ))
    : [];
  const selectedGroupProgress = selectedGroupStudents.flatMap(enrollment => (
    selectedGroupLessons.map(lesson => (
      lessonProgress.find(progress => progress.lesson_id === lesson.id && progress.enrollment_id === enrollment.id)
    )).filter(Boolean)
  )) as TrainingLessonProgress[];
  const selectedGroupAttendanceCount = selectedGroupProgress.filter(progress => progress.attended).length;
  const selectedGroupAcceptedHomeworkCount = selectedGroupProgress.filter(progress => progress.homework_status === 'accepted').length;
  const getLessonProgress = (lessonId: string, enrollmentId: string) => (
    lessonProgress.find(progress => progress.lesson_id === lessonId && progress.enrollment_id === enrollmentId)
  );
  const getIncompleteHomeworkCount = (enrollment: TrainingEnrollment) => (
    lessons
      .filter(lesson => lesson.group_id === enrollment.group_id && (lesson.homework_title || lesson.homework_description))
      .filter(lesson => getLessonProgress(lesson.id, enrollment.id)?.homework_status !== 'accepted')
      .length
  );

  const editProgram = (program: TrainingProgram) => {
    setProgramForm({
      id: program.id,
      slug: program.slug,
      title: program.title,
      format_type: program.format_type || (program.is_group ? 'group' : 'individual'),
      description: program.description || '',
      price: program.price || 0,
      duration_label: program.duration_label || '',
      includes_text: (program.includes || []).join(', '),
      is_group: Boolean(program.is_group),
      is_active: Boolean(program.is_active),
      has_certificate: Boolean(program.has_certificate),
      sort_order: program.sort_order || 0,
    });
    setProgramEditorOpen(true);
  };

  const resetProgramForm = () => setProgramForm(createEmptyProgramForm());

  const openNewProgramEditor = () => {
    resetProgramForm();
    setProgramEditorOpen(true);
  };

  const closeProgramEditor = () => {
    resetProgramForm();
    setProgramEditorOpen(false);
  };

  const saveProgram = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      slug: programForm.slug.trim(),
      title: programForm.title.trim(),
      format_type: programForm.format_type.trim() || (programForm.is_group ? 'group' : 'individual'),
      description: programForm.description.trim(),
      price: Number(programForm.price) || 0,
      duration_label: programForm.duration_label.trim() || null,
      includes: programForm.includes_text
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
      is_group: programForm.is_group,
      is_active: programForm.is_active,
      has_certificate: programForm.has_certificate,
      sort_order: Number(programForm.sort_order) || 0,
    };

    const request = programForm.id
      ? supabase.from('training_programs').update(payload).eq('id', programForm.id)
      : supabase.from('training_programs').insert([payload]);

    const { error } = await request;
    if (error) {
      alert(`Не удалось сохранить курс: ${error.message}`);
      return;
    }

    resetProgramForm();
    setProgramEditorOpen(false);
    await loadData();
  };

  const deleteProgram = async (program: TrainingProgram) => {
    if (!confirm(`Удалить курс “${program.title}”? Если есть заявки, лучше выключить курс, а не удалять.`)) return;

    const { error } = await supabase.from('training_programs').delete().eq('id', program.id);
    if (error) {
      alert(`Не удалось удалить курс: ${error.message}`);
      return;
    }

    await loadData();
  };

  const createGroup = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const payload = {
        program_id: groupForm.program_id,
        title: groupForm.title,
        starts_at: fromDateTimeLocal(groupForm.starts_at),
        capacity: Number(groupForm.capacity) || 1,
        status: 'open',
        notes: groupForm.notes || null,
      };

      const { error } = await supabase.from('training_groups').insert([payload]);
      if (error) throw error;

      setGroupForm({
        program_id: groupForm.program_id,
        title: '',
        starts_at: getDefaultStart(),
        capacity: 6,
        notes: '',
      });
      await loadData();
    } catch (error) {
      alert(`Не удалось создать группу: ${error instanceof Error ? error.message : 'ошибка'}`);
    }
  };

  const updateGroup = async (groupId: string, payload: Record<string, any>) => {
    const { error } = await supabase
      .from('training_groups')
      .update(payload)
      .eq('id', groupId);

    if (error) {
      alert(`Не удалось обновить группу: ${error.message}`);
      return;
    }

    await loadData();
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Удалить группу обучения? Заявки останутся без привязки к группе.')) return;

    const { error } = await supabase.from('training_groups').delete().eq('id', groupId);
    if (error) {
      alert(`Не удалось удалить группу: ${error.message}`);
      return;
    }

    await loadData();
  };

  const updateEnrollment = async (enrollmentId: string, payload: Record<string, any>) => {
    const { error } = await supabase
      .from('training_enrollments')
      .update(payload)
      .eq('id', enrollmentId);

    if (error) {
      alert(`Не удалось обновить заявку: ${error.message}`);
      return;
    }

    await loadData();
  };

  const setEnrollmentStatus = async (enrollment: TrainingEnrollment, status: string) => {
    const payload: Record<string, any> = { status };

    if (status === 'completed' && enrollment.certificate_required && enrollment.exam_status !== 'passed') {
      alert('Этот ученик записан на курс с сертификатом. Завершить курс можно после экзамена.');
      return;
    }

    if (activeStudentStatuses.includes(status) && !enrollment.group_id) {
      const targetGroupId = selectedGroup?.id || groups[0]?.id || '';

      if (!targetGroupId) {
        alert('Перед зачислением создайте группу или выберите группу в заявке.');
        return;
      }

      payload.group_id = targetGroupId;
    }

    if (status === 'contract' && enrollment.payment_status === 'not_requested') {
      payload.payment_status = 'requested';
    }

    await updateEnrollment(enrollment.id, payload);
  };

  const createLesson = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const payload = {
        group_id: lessonForm.group_id,
        title: lessonForm.title,
        lesson_at: fromDateTimeLocal(lessonForm.lesson_at),
        description: lessonForm.description || null,
        homework_title: lessonForm.homework_title || null,
        homework_description: lessonForm.homework_description || null,
        sort_order: Number(lessonForm.sort_order) || 0,
      };

      const { error } = await supabase.from('training_lessons').insert([payload]);
      if (error) throw error;

      setLessonForm({
        group_id: lessonForm.group_id,
        title: '',
        lesson_at: '',
        description: '',
        homework_title: '',
        homework_description: '',
        sort_order: lessonForm.sort_order + 1,
      });
      await loadData();
    } catch (error) {
      alert(`Не удалось создать занятие: ${error instanceof Error ? error.message : 'ошибка'}`);
    }
  };

  const updateLesson = async (lessonId: string, payload: Record<string, any>) => {
    const { error } = await supabase
      .from('training_lessons')
      .update(payload)
      .eq('id', lessonId);

    if (error) {
      alert(`Не удалось обновить занятие: ${error.message}`);
      return;
    }

    await loadData();
  };

  const deleteLesson = async (lessonId: string) => {
    if (!confirm('Удалить занятие и связанные отметки прогресса?')) return;

    const { error } = await supabase.from('training_lessons').delete().eq('id', lessonId);
    if (error) {
      alert(`Не удалось удалить занятие: ${error.message}`);
      return;
    }

    await loadData();
  };

  const seedLessonsFromProgram = async () => {
    if (!selectedGroup) return;
    if (selectedGroupLessons.length > 0 && !confirm('В группе уже есть занятия. Добавить шаблонные занятия в конец списка?')) return;

    const program = programs.find(item => item.id === selectedGroup.program_id);
    const template = TRAINING_LESSON_TEMPLATES[program?.slug || ''] || TRAINING_LESSON_TEMPLATES['group-basic'];
    const startDate = getSafeDate(selectedGroup.starts_at) || new Date();
    const existingMaxSort = selectedGroupLessons.reduce((max, lesson) => Math.max(max, lesson.sort_order || 0), 0);

    const payload = template.map((lesson, index) => {
      const lessonDate = new Date(startDate);
      lessonDate.setDate(startDate.getDate() + index * 7);

      return {
        group_id: selectedGroup.id,
        title: lesson.title,
        description: `Модуль ${index + 1}: ${lesson.title}`,
        lesson_at: lessonDate.toISOString(),
        homework_title: `ДЗ ${index + 1}`,
        homework_description: lesson.homework,
        sort_order: existingMaxSort + index + 1,
      };
    });

    const { error } = await supabase.from('training_lessons').insert(payload);
    if (error) {
      alert(`Не удалось собрать журнал из программы: ${error.message}`);
      return;
    }

    await loadData();
  };

  const addJournalColumn = async () => {
    if (!selectedGroup) return;

    const sortedLessons = [...selectedGroupLessons].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const nextSort = sortedLessons.reduce((max, lesson) => Math.max(max, lesson.sort_order || 0), 0) + 1;
    const previousDate = getSafeDate(sortedLessons[sortedLessons.length - 1]?.lesson_at);
    const groupStartDate = getSafeDate(selectedGroup.starts_at);
    const lessonDate = previousDate || groupStartDate || new Date();

    if (previousDate) {
      lessonDate.setDate(lessonDate.getDate() + 7);
    }

    const payload = {
      group_id: selectedGroup.id,
      title: `Занятие ${nextSort}`,
      lesson_at: lessonDate.toISOString(),
      description: null,
      homework_title: `ДЗ ${nextSort}`,
      homework_description: null,
      sort_order: nextSort,
    };

    const { data, error } = await supabase
      .from('training_lessons')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      alert(`Не удалось добавить столбец: ${error.message}`);
      return;
    }

    await loadData();
    if (data) setEditingLesson(data as TrainingLesson);
  };

  const upsertProgress = async (lessonId: string, enrollmentId: string, payload: Record<string, any>) => {
    const existing = lessonProgress.find(progress => progress.lesson_id === lessonId && progress.enrollment_id === enrollmentId);
    const nextPayload = existing
      ? payload
      : { lesson_id: lessonId, enrollment_id: enrollmentId, ...payload };

    const request = existing
      ? supabase.from('training_lesson_progress').update(nextPayload).eq('id', existing.id)
      : supabase.from('training_lesson_progress').insert([nextPayload]);

    const { error } = await request;
    if (error) {
      alert(`Не удалось обновить прогресс: ${error.message}`);
      return;
    }

    await loadData();
  };

  const updateJournalCell = async (lessonId: string, enrollmentId: string, value: string) => {
    if (!value) {
      await upsertProgress(lessonId, enrollmentId, {
        attended: false,
        attendance_status: 'pending',
        grade: null,
      });
      return;
    }

    if (value === 'absent') {
      await upsertProgress(lessonId, enrollmentId, {
        attended: false,
        attendance_status: 'absent',
        grade: null,
      });
      return;
    }

    if (value === 'attended') {
      await upsertProgress(lessonId, enrollmentId, {
        attended: true,
        attendance_status: 'attended',
        grade: null,
      });
      return;
    }

    await upsertProgress(lessonId, enrollmentId, {
      attended: true,
      attendance_status: 'attended',
      grade: Number(value),
    });
  };

  if (loading) {
    return (
      <div className="rounded-[2rem] bg-white/80 p-6 text-center font-black text-[#385144] shadow-sm">
        Загружаю обучение...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Программы', value: programs.length, icon: BookOpen },
          { label: 'Активные группы', value: stats.activeGroups, icon: Users },
          { label: 'Новые заявки', value: stats.pending, icon: GraduationCap },
          { label: 'К оплате', value: formatTrainingPrice(stats.money), icon: CheckCircle2 },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-[1.5rem] border border-white/80 bg-white/82 p-4 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
              <Icon className="mb-3 h-5 w-5 text-[#B8795C]" />
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9AA39B]">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-[#385144]">{item.value}</p>
            </div>
          );
        })}
      </div>

      {loadWarning && (
        <div className="rounded-2xl border border-[#B8795C]/25 bg-[#FFF9F0] p-4 text-sm font-semibold leading-relaxed text-[#8A5A3F]">
          {loadWarning}
        </div>
      )}

      <section className="rounded-[1.75rem] border border-white/80 bg-white/82 p-4 shadow-[0_16px_40px_rgba(56,81,68,0.08)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">academy control</p>
            <h2 className="text-2xl font-black text-[#385144]">Пульт Академии</h2>
          </div>
          <span className="hidden rounded-full bg-[#F8F3EC] px-4 py-2 text-xs font-black text-[#6C756C] md:inline-flex">
            не всё сразу — по разделам
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { id: 'enrollments' as AdminTrainingSection, label: 'Заявки', text: 'маршрут ученика', value: enrollments.length, icon: GraduationCap },
            { id: 'programs' as AdminTrainingSection, label: 'Курсы', text: 'цены и описания', value: programs.length, icon: BookOpen },
            { id: 'groups' as AdminTrainingSection, label: 'Группы', text: 'старт и места', value: groups.length, icon: Users },
            { id: 'journal' as AdminTrainingSection, label: 'Журнал', text: 'занятия и ДЗ', value: selectedGroupLessons.length, icon: CalendarDays },
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`rounded-[1.35rem] p-4 text-left transition ${
                  isActive
                    ? 'bg-[#385144] text-white shadow-[0_14px_30px_rgba(56,81,68,0.20)]'
                    : 'bg-[#F8F3EC] text-[#385144] hover:bg-[#EFE6DA]'
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-[#F4E7C8]' : 'text-[#B8795C]'}`} />
                  <span className={`rounded-full px-2 py-1 text-xs font-black ${
                    isActive ? 'bg-white/14 text-white' : 'bg-white text-[#6C756C]'
                  }`}>
                    {item.value}
                  </span>
                </div>
                <p className="font-black">{item.label}</p>
                <p className={`mt-1 text-xs font-semibold ${isActive ? 'text-white/62' : 'text-[#6C756C]'}`}>
                  {item.text}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {activeSection === 'programs' && (
      <section className="rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.08)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">training products</p>
            <h2 className="text-2xl font-black text-[#385144]">Курсы и программы</h2>
            <p className="mt-1 text-sm font-semibold text-[#6C756C]">
              Здесь можно создать курс, поменять описание, цену, состав программы и скрыть его с витрины.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewProgramEditor}
            className="shrink-0 rounded-2xl bg-[#385144] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#2d4238]"
          >
            <Plus className="mr-2 inline h-4 w-4" />
            Добавить курс
          </button>
        </div>

        {isProgramEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1F2E27]/45 p-3 backdrop-blur-sm md:items-center">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/70 bg-[#FFFCF7] p-5 shadow-2xl md:p-6">
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex items-start justify-between gap-4 border-b border-[#385144]/10 bg-[#FFFCF7]/95 px-5 py-4 backdrop-blur md:-mx-6 md:-mt-6 md:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B8795C]/75">
                  {programForm.id ? 'course editor' : 'new course'}
                </p>
                <h3 className="mt-1 text-2xl font-black text-[#385144]">
                  {programForm.id ? programForm.title || 'Редактировать курс' : 'Добавить программу обучения'}
                </h3>
                <p className="mt-1 text-sm font-semibold text-[#6C756C]">
                  Цена, описание и видимость курса обновятся в витрине академии.
                </p>
              </div>
              <button
                type="button"
                onClick={closeProgramEditor}
                className="rounded-2xl bg-white p-3 text-[#385144] shadow-sm transition hover:bg-[#EAF1EA]"
                aria-label="Закрыть редактор курса"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
        <form onSubmit={saveProgram} className="rounded-[1.35rem] bg-[#F8F3EC] p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B8795C]">
                {programForm.id ? 'редактирование курса' : 'новый курс'}
              </p>
              <h3 className="text-lg font-black text-[#385144]">
                {programForm.id ? programForm.title || 'Курс' : 'Добавить программу обучения'}
              </h3>
            </div>
            {programForm.id && (
              <button
                type="button"
                onClick={resetProgramForm}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-[#385144]"
              >
                Новый курс
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <input
              value={programForm.title}
              onChange={(event) => setProgramForm({ ...programForm, title: event.target.value })}
              className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-2"
              placeholder="Название курса"
              required
            />
            <input
              value={programForm.slug}
              onChange={(event) => setProgramForm({ ...programForm, slug: event.target.value })}
              className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
              placeholder="slug"
              required
            />
            <input
              type="number"
              min={0}
              value={programForm.price}
              onChange={(event) => setProgramForm({ ...programForm, price: Number(event.target.value) })}
              className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
              placeholder="Цена"
              required
            />
            <input
              value={programForm.duration_label}
              onChange={(event) => setProgramForm({ ...programForm, duration_label: event.target.value })}
              className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
              placeholder="Темп/длительность"
            />
            <input
              type="number"
              value={programForm.sort_order}
              onChange={(event) => setProgramForm({ ...programForm, sort_order: Number(event.target.value) })}
              className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
              placeholder="Сорт."
            />
            <textarea
              value={programForm.description}
              onChange={(event) => setProgramForm({ ...programForm, description: event.target.value })}
              className="min-h-24 rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-3"
              placeholder="Описание курса"
              required
            />
            <textarea
              value={programForm.includes_text}
              onChange={(event) => setProgramForm({ ...programForm, includes_text: event.target.value })}
              className="min-h-24 rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-3"
              placeholder="Что входит через запятую: занятия, ДЗ, практика..."
            />
            <label className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm font-black text-[#385144]">
              <input
                type="checkbox"
                checked={programForm.is_group}
                onChange={(event) => setProgramForm({
                  ...programForm,
                  is_group: event.target.checked,
                  format_type: event.target.checked ? 'group' : 'individual',
                })}
              />
              Групповой курс
            </label>
            <label className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm font-black text-[#385144]">
              <input
                type="checkbox"
                checked={programForm.is_active}
                onChange={(event) => setProgramForm({ ...programForm, is_active: event.target.checked })}
              />
              Показывать клиентам
            </label>
            <label className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm font-black text-[#385144]">
              <input
                type="checkbox"
                checked={programForm.has_certificate}
                onChange={(event) => setProgramForm({ ...programForm, has_certificate: event.target.checked })}
              />
              С сертификатом
            </label>
            <button className="flex items-center justify-center rounded-2xl bg-[#385144] px-4 py-3 font-black text-white md:col-span-2">
              <Save className="mr-2 h-4 w-4" />
              {programForm.id ? 'Сохранить курс' : 'Добавить курс'}
            </button>
          </div>
        </form>
          </div>
        </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {programs.map(program => (
            <div key={program.id} className="rounded-[1.35rem] bg-[#F8F3EC] p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#B8795C]">
                    {program.is_group ? 'групповое' : 'индивидуальное'} · {program.is_active ? 'на витрине' : 'скрыто'}
                  </p>
                  <h3 className="font-black leading-tight text-[#385144]">{program.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => deleteProgram(program)}
                  className="rounded-full bg-white p-2 text-red-500"
                  title="Удалить курс"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xl font-black text-[#8A5A3F]">{getTrainingProgramPriceLabel(program)}</p>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6C756C]">{program.description}</p>
              {(program.includes || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {(program.includes || []).slice(0, 4).map(item => (
                    <span key={item} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#385144]">
                      {item}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => editProgram(program)}
                className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#385144]"
              >
                Редактировать
              </button>
            </div>
          ))}
        </div>
      </section>
      )}

      {activeSection === 'journal' && (
      <section className="rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.08)]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">academy journal</p>
            <h2 className="text-2xl font-black text-[#385144]">Журнал группы</h2>
            <p className="mt-1 text-sm font-semibold text-[#6C756C]">
              Обычный электронный журнал: ученики в строках, занятия в столбцах. Нажмите дату, чтобы открыть урок, ДЗ и сдачи.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedGroup?.id || ''}
              onChange={(event) => {
                setSelectedGroupId(event.target.value);
                setLessonForm(current => ({ ...current, group_id: event.target.value }));
                setEditingLesson(null);
              }}
              className="rounded-2xl border border-[#385144]/10 bg-white px-4 py-3 font-black text-[#385144]"
            >
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.title}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addJournalColumn}
              disabled={!selectedGroup}
              className="inline-flex items-center justify-center rounded-2xl bg-[#385144] px-4 py-3 text-sm font-black text-white transition hover:bg-[#2f4439] disabled:opacity-50"
            >
              <Plus className="mr-2 h-4 w-4" />
              Столбец
            </button>
          </div>
        </div>

        {!selectedGroup ? (
          <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4 text-sm font-semibold text-[#6C756C]">
            Сначала создайте группу обучения — после этого появится журнал.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Ученики', value: selectedGroupStudents.length },
                { label: 'Занятия', value: selectedGroupLessons.length },
                { label: 'Посещения', value: selectedGroupAttendanceCount },
                { label: 'ДЗ принято', value: selectedGroupAcceptedHomeworkCount },
              ].map(item => (
                <div key={item.label} className="rounded-2xl bg-[#F8F3EC] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9AA39B]">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-[#385144]">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[1.35rem] border border-[#385144]/10 bg-white p-4">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#B8795C]/80">group register</p>
                  <h3 className="text-xl font-black text-[#385144]">Учет занятий</h3>
                  <p className="mt-1 text-sm font-semibold text-[#6C756C]">
                    В ячейке — оценка, “✓” или “н”. Новая дата добавляется плюсом.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={seedLessonsFromProgram}
                    className="rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-black text-[#385144] transition hover:bg-[#EAF1EA]"
                  >
                    <BookOpen className="mr-2 inline h-4 w-4 text-[#B8795C]" />
                    Из программы
                  </button>
                  <button
                    type="button"
                    onClick={addJournalColumn}
                    className="rounded-2xl bg-[#385144] px-4 py-3 text-sm font-black text-white transition hover:bg-[#2f4439]"
                  >
                    <Plus className="mr-2 inline h-4 w-4" />
                    Добавить дату
                  </button>
                </div>
              </div>

              {selectedGroupStudents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4 text-sm font-semibold text-[#6C756C]">
                  В группе пока нет учеников. Зачислите ученика — и здесь появится строка журнала.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#385144]/10 bg-white">
                  <table className="min-w-full border-separate border-spacing-0 text-left text-sm text-[#385144]">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-20 min-w-[220px] border-b border-[#385144]/10 bg-white p-4 text-xs font-black uppercase tracking-[0.16em] text-[#8FA092]">
                          Ученик
                        </th>
                        {selectedGroupLessons.map(lesson => {
                          const lessonDate = getSafeDate(lesson.lesson_at);
                          return (
                            <th key={lesson.id} className="min-w-[150px] border-b border-l border-[#385144]/10 bg-[#FBF8F2] p-0 align-top">
                              <button
                                type="button"
                                onClick={() => setEditingLesson(lesson)}
                                className="block h-full w-full p-4 text-left transition hover:bg-[#F8F3EC]"
                                title="Открыть занятие и ДЗ"
                              >
                                <span className="block text-xs font-black uppercase tracking-[0.14em] text-[#B8795C]">
                                  {lesson.sort_order || '—'} занятие
                                </span>
                                <span className="mt-1 block font-black leading-tight text-[#385144]">{lesson.title}</span>
                                <span className="mt-2 block text-xs font-bold text-[#6C756C]">
                                  {lessonDate ? format(lessonDate, 'd MMM, HH:mm', { locale: ru }) : 'без даты'}
                                </span>
                              </button>
                            </th>
                          );
                        })}
                        <th className="min-w-[92px] border-b border-l border-[#385144]/10 bg-[#FBF8F2] p-3 text-center">
                          <button
                            type="button"
                            onClick={addJournalColumn}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#385144] text-white transition hover:bg-[#2f4439]"
                            title="Добавить столбец"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGroupLessons.length === 0 ? (
                        <tr>
                          <td className="sticky left-0 z-10 border-t border-[#385144]/10 bg-white p-4">
                            <p className="font-black">Журнал пустой</p>
                            <p className="text-xs font-semibold text-[#6C756C]">Нажмите “+”, чтобы добавить первую дату.</p>
                          </td>
                          <td className="border-l border-t border-[#385144]/10 p-4 text-sm font-semibold text-[#6C756C]">
                            Или соберите даты из программы курса.
                          </td>
                        </tr>
                      ) : selectedGroupStudents.map(enrollment => (
                        <tr key={enrollment.id}>
                          <td className="sticky left-0 z-10 border-t border-[#385144]/10 bg-white p-4">
                            <p className="font-black">{enrollment.users?.name || 'Ученик'}</p>
                            <p className="text-xs font-semibold text-[#6C756C]">
                              @{enrollment.users?.username || enrollment.users?.telegram_id || 'без username'}
                            </p>
                          </td>
                          {selectedGroupLessons.map(lesson => {
                            const progress = getLessonProgress(lesson.id, enrollment.id);
                            return (
                              <td key={lesson.id} className="border-l border-t border-[#385144]/10 p-3">
                                <select
                                  value={getJournalCellValue(progress)}
                                  onChange={(event) => updateJournalCell(lesson.id, enrollment.id, event.target.value)}
                                  className="mx-auto block w-24 rounded-xl border border-[#385144]/10 bg-[#F8F3EC] p-2 text-center font-black text-[#385144]"
                                >
                                  <option value="">—</option>
                                  <option value="attended">✓</option>
                                  <option value="5">5</option>
                                  <option value="4">4</option>
                                  <option value="3">3</option>
                                  <option value="2">2</option>
                                  <option value="1">1</option>
                                  <option value="absent">н</option>
                                </select>
                              </td>
                            );
                          })}
                          <td className="border-l border-t border-[#385144]/10 bg-[#FBF8F2]" />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {editingLesson && selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#15211B]/50 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-[#FBF8F2] p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]">занятие {editingLesson.sort_order || '—'}</p>
                  <h3 className="text-2xl font-black text-[#385144]">Дата, урок и домашка</h3>
                  <p className="mt-1 text-sm font-semibold text-[#6C756C]">Изменения сохраняются после выхода из поля.</p>
                </div>
                <button type="button" onClick={() => setEditingLesson(null)} className="rounded-full bg-white p-3 text-[#385144] shadow-sm">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  defaultValue={editingLesson.title}
                  onBlur={(event) => event.target.value !== editingLesson.title && updateLesson(editingLesson.id, { title: event.target.value || `Занятие ${editingLesson.sort_order || ''}` })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
                  placeholder="Тема занятия"
                />
                <input
                  type="datetime-local"
                  defaultValue={toDateTimeLocal(editingLesson.lesson_at)}
                  onBlur={(event) => updateLesson(editingLesson.id, { lesson_at: fromDateTimeLocal(event.target.value) })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
                />
                <textarea
                  defaultValue={editingLesson.description || ''}
                  onBlur={(event) => updateLesson(editingLesson.id, { description: event.target.value || null })}
                  className="min-h-28 rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-2"
                  placeholder="Что будет на занятии"
                />
                <input
                  defaultValue={editingLesson.homework_title || ''}
                  onBlur={(event) => updateLesson(editingLesson.id, { homework_title: event.target.value || null })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
                  placeholder="Название ДЗ"
                />
                <textarea
                  defaultValue={editingLesson.homework_description || ''}
                  onBlur={(event) => updateLesson(editingLesson.id, { homework_description: event.target.value || null })}
                  className="min-h-24 rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
                  placeholder="Что сделать дома"
                />
              </div>

              <div className="mt-5 rounded-[1.35rem] bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8FA092]">homework check</p>
                    <h4 className="text-lg font-black text-[#385144]">Сдачи учеников</h4>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteLesson(editingLesson.id);
                      setEditingLesson(null);
                    }}
                    className="rounded-full bg-[#FFF1F0] p-3 text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {selectedGroupStudents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4 text-sm font-semibold text-[#6C756C]">
                    Пока нет учеников для проверки.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedGroupStudents.map(enrollment => {
                      const progress = getLessonProgress(editingLesson.id, enrollment.id);
                      const files = progress?.homework_files || [];
                      const deadline = getHomeworkDeadline(editingLesson, progress);

                      return (
                        <div key={enrollment.id} className="rounded-2xl bg-[#F8F3EC] p-4">
                          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-black text-[#385144]">{enrollment.users?.name || 'Ученик'}</p>
                              <p className="text-xs font-semibold text-[#6C756C]">
                                @{enrollment.users?.username || enrollment.users?.telegram_id || 'без username'}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-black">
                              {deadline && (
                                <span className="rounded-full bg-white px-3 py-1 text-[#8A5A3F]">
                                  Дедлайн: {format(deadline, 'd MMM, HH:mm', { locale: ru })}
                                </span>
                              )}
                              <span className="rounded-full bg-white px-3 py-1 text-[#385144]">
                                {homeworkStatusLabels[progress?.homework_status || 'not_started'] || 'Не начато'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_190px_1fr]">
                            <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#385144]">
                              <input
                                type="checkbox"
                                checked={Boolean(progress?.attended)}
                                onChange={(event) => upsertProgress(editingLesson.id, enrollment.id, {
                                  attended: event.target.checked,
                                  attendance_status: event.target.checked ? 'attended' : 'pending',
                                })}
                              />
                              Был(а)
                            </label>
                            <select
                              value={progress?.homework_status || 'not_started'}
                              onChange={(event) => upsertProgress(editingLesson.id, enrollment.id, { homework_status: event.target.value })}
                              className="rounded-xl border border-[#385144]/10 bg-white p-2 text-sm font-bold text-[#385144]"
                            >
                              {homeworkStatuses.map(status => (
                                <option key={status} value={status}>{homeworkStatusLabels[status] || status}</option>
                              ))}
                            </select>
                            <textarea
                              defaultValue={progress?.homework_note || ''}
                              onBlur={(event) => upsertProgress(editingLesson.id, enrollment.id, { homework_note: event.target.value || null })}
                              className="rounded-xl border border-[#385144]/10 bg-white p-2 text-sm font-semibold text-[#385144]"
                              placeholder="Комментарий по домашке"
                            />
                          </div>

                          {(progress?.homework_submitted_text || files.length > 0) && (
                            <div className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-[#385144]">
                              {progress?.homework_submitted_text && (
                                <p className="mb-2 whitespace-pre-wrap text-[#657066]">{progress.homework_submitted_text}</p>
                              )}
                              {files.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {files.map(file => (
                                    <span key={file.path} className="rounded-full bg-[#EAF1EA] px-3 py-1 text-xs font-black text-[#385144]">
                                      {file.name}
                                      {file.storage === 'telegram' ? ' · в Telegram' : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                            <button
                              type="button"
                              onClick={() => upsertProgress(editingLesson.id, enrollment.id, { homework_status: 'accepted', homework_note: progress?.homework_note || 'ДЗ принято' })}
                              className="rounded-xl bg-[#385144] px-3 py-2 text-sm font-black text-white"
                            >
                              Принять ДЗ
                            </button>
                            <button
                              type="button"
                              onClick={() => upsertProgress(editingLesson.id, enrollment.id, { homework_status: 'revise' })}
                              className="rounded-xl bg-[#FFF9F0] px-3 py-2 text-sm font-black text-[#8A5A3F]"
                            >
                              На доработку
                            </button>
                            <button
                              type="button"
                              onClick={() => upsertProgress(editingLesson.id, enrollment.id, { homework_unlocked_by_admin: true })}
                              className="rounded-xl bg-white px-3 py-2 text-sm font-black text-[#385144]"
                            >
                              Открыть сдачу
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      )}

      {false && activeSection === 'journal' && (
      <section className="rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.08)]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">academy journal</p>
            <h2 className="text-2xl font-black text-[#385144]">Журнал группы</h2>
            <p className="mt-1 text-sm font-semibold text-[#6C756C]">
              Здесь добавляются занятия, домашки, посещаемость и проверка ДЗ.
            </p>
          </div>
          <select
            value={selectedGroup?.id || ''}
            onChange={(event) => {
              setSelectedGroupId(event.target.value);
              setLessonForm(current => ({ ...current, group_id: event.target.value }));
            }}
            className="rounded-2xl border border-[#385144]/10 bg-white px-4 py-3 font-black text-[#385144]"
          >
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.title}</option>
            ))}
          </select>
        </div>

        {!selectedGroup ? (
          <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4 text-sm font-semibold text-[#6C756C]">
            Сначала создайте группу обучения — после этого появится журнал, занятия и домашки.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Ученики', value: selectedGroupStudents.length },
                { label: 'Занятия', value: selectedGroupLessons.length },
                { label: 'Посещения', value: selectedGroupAttendanceCount },
                { label: 'ДЗ принято', value: selectedGroupAcceptedHomeworkCount },
              ].map(item => (
                <div key={item.label} className="rounded-2xl bg-[#F8F3EC] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9AA39B]">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-[#385144]">{item.value}</p>
                </div>
              ))}
            </div>

            <form onSubmit={createLesson} className="rounded-[1.35rem] bg-[#F8F3EC] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B8795C]">новое занятие</p>
                  <h3 className="text-lg font-black text-[#385144]">Добавить занятие и ДЗ</h3>
                </div>
                <button
                  type="button"
                  onClick={seedLessonsFromProgram}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#385144] shadow-sm transition hover:bg-[#EAF1EA]"
                >
                  <BookOpen className="mr-2 inline h-4 w-4 text-[#B8795C]" />
                  Собрать журнал из программы
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                <input
                  value={lessonForm.title}
                  onChange={(event) => setLessonForm({ ...lessonForm, group_id: selectedGroup.id, title: event.target.value })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-2"
                  placeholder="Тема занятия"
                  required
                />
                <input
                  type="datetime-local"
                  value={lessonForm.lesson_at}
                  onChange={(event) => setLessonForm({ ...lessonForm, group_id: selectedGroup.id, lesson_at: event.target.value })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
                />
                <input
                  type="number"
                  value={lessonForm.sort_order}
                  onChange={(event) => setLessonForm({ ...lessonForm, group_id: selectedGroup.id, sort_order: Number(event.target.value) })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
                  placeholder="№"
                />
                <input
                  value={lessonForm.homework_title}
                  onChange={(event) => setLessonForm({ ...lessonForm, group_id: selectedGroup.id, homework_title: event.target.value })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-2"
                  placeholder="Название ДЗ"
                />
                <textarea
                  value={lessonForm.description}
                  onChange={(event) => setLessonForm({ ...lessonForm, group_id: selectedGroup.id, description: event.target.value })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-3"
                  placeholder="Что будет на занятии"
                />
                <textarea
                  value={lessonForm.homework_description}
                  onChange={(event) => setLessonForm({ ...lessonForm, group_id: selectedGroup.id, homework_description: event.target.value })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-2"
                  placeholder="Что сделать дома"
                />
                <button className="flex items-center justify-center rounded-2xl bg-[#385144] px-4 py-3 font-black text-white">
                  <Save className="mr-2 h-4 w-4" />
                  Добавить
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {selectedGroupLessons.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4 text-sm font-semibold text-[#6C756C] xl:col-span-2">
                  В этой группе пока нет занятий. Нажмите “Собрать журнал из программы” — я создам уроки по плану курса, даты от старта группы и домашки.
                </div>
              ) : selectedGroupLessons.map(lesson => {
                const lessonDate = getSafeDate(lesson.lesson_at);
                return (
                  <div key={lesson.id} className="rounded-[1.35rem] bg-[#F8F3EC] p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#B8795C]">занятие {lesson.sort_order}</p>
                        <h3 className="text-lg font-black text-[#385144]">{lesson.title}</h3>
                        <p className="text-sm font-bold text-[#8A5A3F]">
                          {lessonDate ? format(lessonDate, 'd MMMM yyyy, HH:mm', { locale: ru }) : 'Дата не указана'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteLesson(lesson.id)}
                        className="rounded-full bg-white px-3 py-2 text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <input
                        defaultValue={lesson.title}
                        onBlur={(event) => event.target.value !== lesson.title && updateLesson(lesson.id, { title: event.target.value })}
                        className="rounded-xl border border-[#385144]/10 bg-white p-3 text-sm font-bold text-[#385144]"
                        placeholder="Тема занятия"
                      />
                      <input
                        type="datetime-local"
                        defaultValue={toDateTimeLocal(lesson.lesson_at)}
                        onBlur={(event) => updateLesson(lesson.id, { lesson_at: fromDateTimeLocal(event.target.value) })}
                        className="rounded-xl border border-[#385144]/10 bg-white p-3 text-sm font-bold text-[#385144]"
                      />
                      <textarea
                        defaultValue={lesson.description || ''}
                        onBlur={(event) => updateLesson(lesson.id, { description: event.target.value || null })}
                        className="rounded-xl border border-[#385144]/10 bg-white p-3 text-sm font-bold text-[#385144] md:col-span-2"
                        placeholder="Описание занятия"
                      />
                      <input
                        defaultValue={lesson.homework_title || ''}
                        onBlur={(event) => updateLesson(lesson.id, { homework_title: event.target.value || null })}
                        className="rounded-xl border border-[#385144]/10 bg-white p-3 text-sm font-bold text-[#385144]"
                        placeholder="Название ДЗ"
                      />
                      <textarea
                        defaultValue={lesson.homework_description || ''}
                        onBlur={(event) => updateLesson(lesson.id, { homework_description: event.target.value || null })}
                        className="rounded-xl border border-[#385144]/10 bg-white p-3 text-sm font-bold text-[#385144]"
                        placeholder="Текст ДЗ"
                      />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[#8FA092]">
                      Изменения сохраняются после выхода из поля.
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-[1.35rem] bg-[#385144] p-4 text-white">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/55">group register</p>
                  <h3 className="text-xl font-black">Учет учеников</h3>
                </div>
                <Users className="h-6 w-6 text-white/75" />
              </div>
              {selectedGroupStudents.length === 0 ? (
                <div className="rounded-2xl bg-white/10 p-4 text-sm font-semibold text-white/75">
                  В группе пока нет зачисленных учеников. В заявках ниже выберите группу и статус “Зачислен(а)”.
                </div>
              ) : selectedGroupLessons.length === 0 ? (
                <div className="rounded-2xl bg-white/10 p-4 text-sm font-semibold text-white/75">
                  Ученик уже есть, но колонок журнала пока нет. Сначала соберите занятия из программы или добавьте урок вручную — после этого появятся даты и ячейки оценок.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-2xl bg-white text-[#385144]">
                    <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-white p-3 text-xs font-black uppercase tracking-[0.16em] text-[#8FA092]">
                            Ученик
                          </th>
                          {selectedGroupLessons.map(lesson => {
                            const lessonDate = getSafeDate(lesson.lesson_at);
                            return (
                              <th key={lesson.id} className="min-w-[132px] border-l border-[#385144]/10 p-3 text-xs font-black text-[#385144]">
                                <span className="block">{lesson.sort_order}. {lesson.title}</span>
                                <span className="mt-1 block font-semibold text-[#6C756C]">
                                  {lessonDate ? format(lessonDate, 'd MMM', { locale: ru }) : 'без даты'}
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGroupStudents.map(enrollment => (
                          <tr key={enrollment.id}>
                            <td className="sticky left-0 z-10 border-t border-[#385144]/10 bg-white p-3">
                              <p className="font-black">{enrollment.users?.name || 'Ученик'}</p>
                              <p className="text-xs font-semibold text-[#6C756C]">
                                @{enrollment.users?.username || enrollment.users?.telegram_id || 'без username'}
                              </p>
                            </td>
                            {selectedGroupLessons.map(lesson => {
                              const progress = getLessonProgress(lesson.id, enrollment.id);
                              return (
                                <td key={lesson.id} className="border-l border-t border-[#385144]/10 p-3">
                                  <select
                                    value={getJournalCellValue(progress)}
                                    onChange={(event) => updateJournalCell(lesson.id, enrollment.id, event.target.value)}
                                    className="w-full rounded-xl border border-[#385144]/10 bg-[#F8F3EC] p-2 text-center font-black text-[#385144]"
                                  >
                                    <option value="">—</option>
                                    <option value="attended">✓</option>
                                    <option value="5">5</option>
                                    <option value="4">4</option>
                                    <option value="3">3</option>
                                    <option value="2">2</option>
                                    <option value="1">1</option>
                                    <option value="absent">н</option>
                                  </select>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedGroupStudents.map(enrollment => {
                    const acceptedCount = selectedGroupLessons.filter(lesson => (
                      getLessonProgress(lesson.id, enrollment.id)?.homework_status === 'accepted'
                    )).length;
                    const attendedCount = selectedGroupLessons.filter(lesson => (
                      getLessonProgress(lesson.id, enrollment.id)?.attended
                    )).length;

                    return (
                      <div key={enrollment.id} className="rounded-2xl bg-white p-4 text-[#385144]">
                        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h4 className="text-lg font-black">{enrollment.users?.name || 'Ученик'}</h4>
                            <p className="text-sm font-semibold text-[#6C756C]">
                              @{enrollment.users?.username || enrollment.users?.telegram_id || 'без username'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-[#EAF1EA] px-3 py-1 text-xs font-black">
                              Был(а): {attendedCount}/{selectedGroupLessons.length}
                            </span>
                            <span className="rounded-full bg-[#F8F3EC] px-3 py-1 text-xs font-black text-[#8A5A3F]">
                              ДЗ: {acceptedCount}/{selectedGroupLessons.length}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {selectedGroupLessons.map(lesson => {
                            const progress = getLessonProgress(lesson.id, enrollment.id);
                            const files = progress?.homework_files || [];
                            const deadline = getHomeworkDeadline(lesson, progress);
                            return (
                              <div key={lesson.id} className="grid grid-cols-1 gap-2 rounded-2xl bg-[#F8F3EC] p-3 md:grid-cols-[1fr_auto_190px] md:items-center">
                                <div>
                                  <p className="text-sm font-black">{lesson.sort_order}. {lesson.title}</p>
                                  {lesson.homework_title && (
                                    <p className="text-xs font-semibold text-[#6C756C]">ДЗ: {lesson.homework_title}</p>
                                  )}
                                  {deadline && (
                                    <p className="mt-1 text-[11px] font-bold text-[#8A5A3F]">
                                      Дедлайн: {format(deadline, 'd MMM, HH:mm', { locale: ru })}
                                    </p>
                                  )}
                                </div>
                                <label className="flex items-center gap-2 text-sm font-bold">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(progress?.attended)}
                                    onChange={(event) => upsertProgress(lesson.id, enrollment.id, {
                                      attended: event.target.checked,
                                      attendance_status: event.target.checked ? 'attended' : 'pending',
                                    })}
                                  />
                                  Был(а)
                                </label>
                                <select
                                  value={progress?.homework_status || 'not_started'}
                                  onChange={(event) => upsertProgress(lesson.id, enrollment.id, { homework_status: event.target.value })}
                                  className="rounded-xl border border-[#385144]/10 bg-white p-2 text-sm font-bold text-[#385144]"
                                >
                                  {homeworkStatuses.map(status => (
                                    <option key={status} value={status}>{homeworkStatusLabels[status] || status}</option>
                                  ))}
                                </select>
                                <textarea
                                  defaultValue={progress?.homework_note || ''}
                                  onBlur={(event) => upsertProgress(lesson.id, enrollment.id, { homework_note: event.target.value || null })}
                                  className="rounded-xl border border-[#385144]/10 bg-white p-2 text-sm font-semibold text-[#385144] md:col-span-3"
                                  placeholder="Комментарий по занятию или домашке"
                                />
                                {(progress?.homework_submitted_text || files.length > 0) && (
                                  <div className="rounded-xl bg-white p-3 text-sm font-semibold text-[#385144] md:col-span-3">
                                    {progress?.homework_submitted_text && (
                                      <p className="mb-2 whitespace-pre-wrap text-[#657066]">{progress.homework_submitted_text}</p>
                                    )}
                                    {files.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {files.map(file => (
                                          <span
                                            key={file.path}
                                            className="rounded-full bg-[#EAF1EA] px-3 py-1 text-xs font-black text-[#385144]"
                                          >
                                            {file.name}
                                            {file.storage === 'telegram' ? ' · в Telegram' : ''}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="grid grid-cols-1 gap-2 md:col-span-3 md:grid-cols-3">
                                  <button
                                    type="button"
                                    onClick={() => upsertProgress(lesson.id, enrollment.id, { homework_status: 'accepted', homework_note: progress?.homework_note || 'ДЗ принято' })}
                                    className="rounded-xl bg-[#385144] px-3 py-2 text-sm font-black text-white"
                                  >
                                    Принять ДЗ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => upsertProgress(lesson.id, enrollment.id, { homework_status: 'revise' })}
                                    className="rounded-xl bg-[#FFF9F0] px-3 py-2 text-sm font-black text-[#8A5A3F]"
                                  >
                                    На доработку
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => upsertProgress(lesson.id, enrollment.id, { homework_unlocked_by_admin: true })}
                                    className="rounded-xl bg-white px-3 py-2 text-sm font-black text-[#385144]"
                                  >
                                    Открыть сдачу
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      )}

      {activeSection === 'groups' && (
      <section className="rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">group control</p>
            <h2 className="text-2xl font-black text-[#385144]">Открыть группу</h2>
          </div>
          <Plus className="h-6 w-6 text-[#B8795C]" />
        </div>

        <form onSubmit={createGroup} className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <select
            value={groupForm.program_id}
            onChange={(event) => setGroupForm({ ...groupForm, program_id: event.target.value })}
            className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-2"
            required
          >
            {programs.filter(program => program.is_group).map(program => (
              <option key={program.id} value={program.id}>{program.title}</option>
            ))}
          </select>
          <input
            value={groupForm.title}
            onChange={(event) => setGroupForm({ ...groupForm, title: event.target.value })}
            className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
            placeholder="Название группы"
            required
          />
          <input
            type="datetime-local"
            value={groupForm.starts_at}
            onChange={(event) => setGroupForm({ ...groupForm, starts_at: event.target.value })}
            className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
            required
          />
          <input
            type="number"
            min={1}
            value={groupForm.capacity}
            onChange={(event) => setGroupForm({ ...groupForm, capacity: Number(event.target.value) })}
            className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
            placeholder="Мест"
            required
          />
          <textarea
            value={groupForm.notes}
            onChange={(event) => setGroupForm({ ...groupForm, notes: event.target.value })}
            className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-4"
            placeholder="Комментарий для себя"
          />
          <button className="flex items-center justify-center rounded-2xl bg-[#385144] px-4 py-3 font-black text-white">
            <Save className="mr-2 h-4 w-4" />
            Создать
          </button>
        </form>

        <div className="mt-4 space-y-3">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4 text-sm font-semibold text-[#6C756C]">
              Групп пока нет. Создайте первый поток обучения.
            </div>
          ) : groups.map(group => {
            const program = programs.find(item => item.id === group.program_id);
            const startsAt = getSafeDate(group.starts_at);
            const taken = group.taken || 0;

            return (
              <div key={group.id} className="rounded-[1.35rem] bg-[#F8F3EC] p-4">
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-[#385144]">{group.title}</h3>
                    <p className="text-sm font-semibold text-[#6C756C]">{program?.title || 'Программа обучения'}</p>
                    <p className="mt-1 flex items-center text-sm font-bold text-[#8A5A3F]">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {startsAt ? format(startsAt, 'd MMMM yyyy, HH:mm', { locale: ru }) : 'Дата не указана'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#385144]">
                      {taken}/{group.capacity} мест
                    </span>
                    <select
                      value={group.status}
                      onChange={(event) => updateGroup(group.id, { status: event.target.value })}
                      className="rounded-full border border-[#385144]/10 bg-white px-3 py-1 text-xs font-black text-[#385144]"
                    >
                      {groupStatuses.map(status => (
                        <option key={status} value={status}>{trainingGroupStatusLabels[status] || status}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => deleteGroup(group.id)}
                      className="rounded-full bg-white px-3 py-1 text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                  <input
                    defaultValue={group.title}
                    onBlur={(event) => updateGroup(group.id, { title: event.target.value })}
                    className="rounded-xl border border-[#385144]/10 bg-white p-3 text-sm font-bold text-[#385144] md:col-span-2"
                    placeholder="Название группы"
                  />
                  <select
                    defaultValue={group.program_id}
                    onChange={(event) => updateGroup(group.id, { program_id: event.target.value })}
                    className="rounded-xl border border-[#385144]/10 bg-white p-3 text-sm font-bold text-[#385144] md:col-span-2"
                  >
                    {programs.filter(item => item.is_group).map(item => (
                      <option key={item.id} value={item.id}>{item.title}</option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    defaultValue={toDateTimeLocal(group.starts_at)}
                    onBlur={(event) => updateGroup(group.id, { starts_at: fromDateTimeLocal(event.target.value) })}
                    className="rounded-xl border border-[#385144]/10 bg-white p-3 text-sm font-bold text-[#385144]"
                  />
                  <input
                    type="number"
                    min={1}
                    defaultValue={group.capacity}
                    onBlur={(event) => updateGroup(group.id, { capacity: Number(event.target.value) || 1 })}
                    className="rounded-xl border border-[#385144]/10 bg-white p-3 text-sm font-bold text-[#385144]"
                    placeholder="Мест"
                  />
                  <textarea
                    defaultValue={group.notes || ''}
                    onBlur={(event) => updateGroup(group.id, { notes: event.target.value || null })}
                    className="rounded-xl border border-[#385144]/10 bg-white p-3 text-sm font-bold text-[#385144] md:col-span-6"
                    placeholder="Заметка по группе"
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-[#8FA092]">
                  Дату старта, численность и программу можно менять прямо здесь. Ученики переносятся в блоке заявок через поле “группа”.
                </p>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {activeSection === 'enrollments' && (
      <section className="rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.08)]">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">enrollments</p>
          <h2 className="text-2xl font-black text-[#385144]">Заявки на обучение</h2>
        </div>

        <div className="space-y-3">
          {enrollments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4 text-sm font-semibold text-[#6C756C]">
              Заявок на обучение пока нет.
            </div>
          ) : enrollments.map(enrollment => {
            const incompleteHomeworkCount = getIncompleteHomeworkCount(enrollment);
            const canExpel = activeStudentStatuses.includes(enrollment.status) && incompleteHomeworkCount >= 5;
            const isOffRouteStatus = !enrollmentRouteStatuses.includes(enrollment.status);

            return (
            <div key={enrollment.id} className="rounded-[1.35rem] bg-[#F8F3EC] p-4">
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-black text-[#385144]">{enrollment.users?.name || 'Клиент'}</h3>
                  <p className="text-sm font-semibold text-[#6C756C]">{enrollment.training_programs?.title || 'Обучение Таро'}</p>
                  {enrollment.training_groups && (
                    <p className="text-sm font-bold text-[#8A5A3F]">Группа: {enrollment.training_groups.title}</p>
                  )}
                  {enrollment.client_comment && (
                    <p className="mt-2 rounded-2xl bg-white/70 p-3 text-sm font-semibold text-[#59645C]">{enrollment.client_comment}</p>
                  )}
                  {enrollment.preferred_start && (
                    <p className="mt-2 text-sm font-bold text-[#59645C]">Старт: {enrollment.preferred_start}</p>
                  )}
                </div>
                <div className="text-left md:text-right">
                  <p className="text-2xl font-black text-[#8A5A3F]">{formatTrainingPrice(enrollment.final_price)}</p>
                  <p className="text-xs font-semibold text-[#6C756C]">
                    {enrollment.created_at ? format(new Date(enrollment.created_at), 'd MMMM, HH:mm', { locale: ru }) : ''}
                  </p>
                </div>
              </div>
              <div className="mb-3 rounded-[1.2rem] bg-white/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#B8795C]">Маршрут ученика</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${
                    enrollment.status === 'expelled'
                      ? 'bg-[#8A5A3F] text-white'
                      : enrollment.status === 'cancelled'
                        ? 'bg-[#E8DDD1] text-[#6C756C]'
                        : 'bg-[#EAF1EA] text-[#385144]'
                  }`}>
                    {trainingStatusLabels[enrollment.status] || enrollment.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                  {enrollmentRouteStatuses.map((status, index) => {
                    const isActive = enrollment.status === status;
                    const isPast = enrollmentRouteStatuses.indexOf(enrollment.status) > index;

                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setEnrollmentStatus(enrollment, status)}
                        className={`rounded-2xl px-3 py-3 text-left text-xs font-black transition ${
                          isActive
                            ? 'bg-[#385144] text-white shadow-[0_10px_22px_rgba(56,81,68,0.18)]'
                            : isPast
                              ? 'bg-[#EAF1EA] text-[#385144]'
                              : 'bg-white text-[#6C756C] hover:bg-[#F8F3EC]'
                        }`}
                      >
                        <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] opacity-60">
                          шаг {index + 1}
                        </span>
                        {trainingStatusLabels[status]}
                      </button>
                    );
                  })}
                </div>
                {isOffRouteStatus && (
                  <p className="mt-2 text-xs font-semibold text-[#8A5A3F]">
                    Запись сейчас вне маршрута. Выберите нужный этап кнопкой выше.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <select
                  value={enrollment.payment_status}
                  onChange={(event) => updateEnrollment(enrollment.id, { payment_status: event.target.value })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
                >
                  {paymentStatuses.map(status => (
                    <option key={status} value={status}>{trainingPaymentLabels[status] || status}</option>
                  ))}
                </select>
                <select
                  value={enrollment.group_id || ''}
                  onChange={(event) => updateEnrollment(enrollment.id, { group_id: event.target.value || null })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
                >
                  <option value="">Без группы</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.title}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={enrollment.final_price || 0}
                  onChange={(event) => updateEnrollment(enrollment.id, { final_price: Number(event.target.value) || 0 })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144]"
                />
                {enrollment.certificate_required && (
                  <select
                    value={enrollment.exam_status || 'pending'}
                    onChange={(event) => updateEnrollment(enrollment.id, { exam_status: event.target.value })}
                    className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-3"
                  >
                    <option value="pending">Экзамен ожидается</option>
                    <option value="scheduled">Экзамен назначен</option>
                    <option value="passed">Экзамен сдан</option>
                    <option value="failed">Экзамен не сдан</option>
                    <option value="not_required">Без экзамена</option>
                  </select>
                )}
                <textarea
                  defaultValue={enrollment.admin_notes || ''}
                  onBlur={(event) => updateEnrollment(enrollment.id, { admin_notes: event.target.value || null })}
                  className="rounded-2xl border border-[#385144]/10 bg-white p-3 font-bold text-[#385144] md:col-span-3"
                  placeholder="Внутренняя заметка по ученику: темп, особенности, договорённости"
                />
              </div>
              {canExpel && (
                <div className="mt-3 rounded-2xl border border-[#B8795C]/25 bg-[#FFF9F0] p-3 text-sm font-bold text-[#8A5A3F]">
                  У ученика {incompleteHomeworkCount} невыполненных домашних заданий. Можно отчислить отдельным действием.
                </div>
              )}
              {enrollment.status === 'cancelled' && (
                <button
                  type="button"
                  onClick={() => setEnrollmentStatus(enrollment, 'pending')}
                  className="mt-3 w-full rounded-2xl bg-[#385144] px-4 py-3 font-black text-white shadow-[0_12px_28px_rgba(56,81,68,0.18)]"
                >
                  Вернуть в маршрут
                </button>
              )}
              {canExpel && (
                <button
                  type="button"
                  onClick={() => setEnrollmentStatus(enrollment, 'expelled')}
                  className="mt-3 w-full rounded-2xl bg-[#8A5A3F] px-4 py-3 font-black text-white shadow-[0_12px_28px_rgba(138,90,63,0.18)]"
                >
                  Отчислить ученика
                </button>
              )}
              {!['cancelled', 'expelled', 'completed'].includes(enrollment.status) && (
                <button
                  type="button"
                  onClick={() => setEnrollmentStatus(enrollment, 'cancelled')}
                  className="mt-3 w-full rounded-2xl bg-white px-4 py-3 font-black text-[#8A5A3F] shadow-sm"
                >
                  Отменить заявку
                </button>
              )}
              {enrollment.group_id && activeStudentStatuses.includes(enrollment.status) && (
                <div className="mt-3 rounded-2xl bg-white/70 p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#B8795C]">Прогресс ученика</p>
                  <div className="space-y-2">
                    {lessons.filter(lesson => lesson.group_id === enrollment.group_id).map(lesson => {
                      const progress = lessonProgress.find(item => item.lesson_id === lesson.id && item.enrollment_id === enrollment.id);
                      return (
                        <div key={lesson.id} className="grid grid-cols-1 gap-2 rounded-2xl bg-[#F8F3EC] p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                          <p className="text-sm font-black text-[#385144]">{lesson.sort_order}. {lesson.title}</p>
                          <label className="flex items-center gap-2 text-sm font-bold text-[#385144]">
                            <input
                              type="checkbox"
                              checked={Boolean(progress?.attended)}
                              onChange={(event) => upsertProgress(lesson.id, enrollment.id, { attended: event.target.checked })}
                            />
                            Был(а)
                          </label>
                          <select
                            value={progress?.homework_status || 'not_started'}
                            onChange={(event) => upsertProgress(lesson.id, enrollment.id, { homework_status: event.target.value })}
                            className="rounded-xl border border-[#385144]/10 bg-white p-2 text-sm font-bold text-[#385144]"
                          >
                            {homeworkStatuses.map(status => (
                              <option key={status} value={status}>{homeworkStatusLabels[status] || status}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      </section>
      )}
    </div>
  );
};
