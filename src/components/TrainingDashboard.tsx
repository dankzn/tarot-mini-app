import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ArrowLeft, Check, CheckCircle2, ChevronRight, Clock, GraduationCap, HelpCircle, MessageSquare, Route, Sparkles, Target, Users } from 'lucide-react';
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

const getSafeDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getGroupPlacesLeft = (group: TrainingGroup) => Math.max((group.capacity || 0) - (group.taken || 0), 0);

const TRAINING_PATH = [
  { title: 'База', text: 'Структура колоды, арканы, логика чтения и безопасный вход в практику.' },
  { title: 'Практика', text: 'Первые расклады, вопросы, связки карт и разбор реальных ситуаций.' },
  { title: 'Этика', text: 'Как консультировать бережно: границы, формулировки и ответственность.' },
  { title: 'Самостоятельность', text: 'Собираем личный стиль чтения и понятный план дальнейшей практики.' },
];

const TRAINING_RESULTS = [
  'понимать структуру колоды без зубрёжки',
  'читать простые и сложные расклады спокойнее',
  'формулировать вопросы и видеть связки карт',
  'практиковать без мистического шума и страха ошибиться',
];

const FIT_ITEMS = [
  { title: 'Подходит', text: 'если хочется бережно войти в Таро, получить структуру и практику.' },
  { title: 'Не подходит', text: 'если нужен быстрый “сертификат без участия” или обещание магического результата.' },
];

const QUIZ_STEPS = [
  {
    id: 'level',
    title: 'Какой у вас опыт?',
    options: [
      { id: 'new', label: 'Я начинаю с нуля' },
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
  const [enrollmentKind, setEnrollmentKind] = useState<'application' | 'waitlist'>('application');
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [lessonProgress, setLessonProgress] = useState<TrainingLessonProgress[]>([]);

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
    ['enrolled', 'completed'].includes(enrollment.status) && enrollment.group_id
  ));
  const studentLessons = activeStudentEnrollment
    ? lessons.filter(lesson => lesson.group_id === activeStudentEnrollment.group_id)
    : [];
  const getProgressForLesson = (lessonId: string) => (
    lessonProgress.find(progress => (
      progress.lesson_id === lessonId && progress.enrollment_id === activeStudentEnrollment?.id
    ))
  );
  const completedHomeworks = studentLessons.filter(lesson => (
    getProgressForLesson(lesson.id)?.homework_status === 'accepted'
  )).length;
  const attendedLessons = studentLessons.filter(lesson => getProgressForLesson(lesson.id)?.attended).length;

  const getProgramGroups = (programId: string) => (
    groups.filter(group => group.program_id === programId && group.status === 'open' && getGroupPlacesLeft(group) > 0)
  );

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

  const openEnrollment = (program: TrainingProgram, kind: 'application' | 'waitlist' = 'application') => {
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
        status: enrollmentKind === 'waitlist' ? 'waitlist' : 'pending',
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_42%,#EFE6DA_100%)] pb-10 text-[#2F463B]">
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
            className="rounded-2xl bg-[#385144] px-4 py-3 text-sm font-black text-white shadow-sm"
          >
            Консультации
          </button>
        </div>

        <section className="mb-5 overflow-hidden rounded-[2.2rem] bg-[#385144] p-6 text-white shadow-[0_22px_48px_rgba(56,81,68,0.22)]">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-[#F4E7C8]">tarot academy</p>
          <h1 className="text-4xl font-black leading-none">Обучение Таро</h1>
          <p className="mt-4 text-sm font-semibold leading-relaxed text-white/78">
            Не просто “курс”, а персональный маршрут: понять ваш уровень, выбрать темп и довести до уверенной практики.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {['лично', 'группа', 'практика'].map(item => (
              <div key={item} className="rounded-2xl bg-white/12 px-3 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-white/80">
                {item}
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
            className="mt-5 flex w-full items-center justify-center rounded-2xl bg-white py-4 font-black text-[#385144] shadow-[0_14px_32px_rgba(0,0,0,0.10)]"
          >
            <HelpCircle className="mr-2 h-5 w-5" />
            Подобрать обучение
          </button>
        </section>

        {activeStudentEnrollment && (
          <section className="mb-5 rounded-[1.9rem] border border-white/80 bg-white/86 p-5 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">student cabinet</p>
                <h2 className="text-2xl font-black text-[#385144]">Личный кабинет ученика</h2>
                <p className="mt-1 text-sm font-semibold text-[#657066]">
                  {activeStudentEnrollment.training_groups?.title || 'Курс обучения'}
                </p>
              </div>
              <GraduationCap className="h-7 w-7 text-[#B8795C]" />
            </div>

            <div className="mb-4 rounded-2xl bg-[#385144] p-4 text-white">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F4E7C8]">вы зачислены</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-white/78">
                Здесь сохраняется всё, что происходит на курсе: план занятий, история посещений, домашние задания и статус проверки.
              </p>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
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

            {studentLessons.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#B8795C]/30 bg-[#FFF9F0] p-4 text-sm font-semibold text-[#6C756C]">
                План курса скоро появится здесь. После добавления занятия в админке оно сразу будет видно в кабинете.
              </div>
            ) : (
              <div className="space-y-3">
                {studentLessons.map((lesson, index) => {
                  const progress = getProgressForLesson(lesson.id);
                  const lessonDate = getSafeDate(lesson.lesson_at);
                  return (
                    <div key={lesson.id} className="rounded-[1.35rem] bg-[#F8F3EC] p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
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
                          {progress?.attended ? 'Был(а)' : 'Не отмечено'}
                        </span>
                      </div>
                      {lesson.description && <p className="mb-3 text-sm font-semibold text-[#657066]">{lesson.description}</p>}
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
          </section>
        )}

        {!activeStudentEnrollment && (
        <section className="mb-5 rounded-[1.8rem] border border-white/80 bg-white/82 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.10)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">learning route</p>
              <h2 className="text-2xl font-black text-[#385144]">Маршрут обучения</h2>
            </div>
            <Route className="h-6 w-6 text-[#B8795C]" />
          </div>
          <div className="space-y-3">
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
        </section>
        )}

        {!activeStudentEnrollment && (
        <section className="mb-5 grid grid-cols-1 gap-3">
          <div className="rounded-[1.8rem] border border-white/80 bg-white/82 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.08)]">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">result</p>
            <h2 className="mb-4 flex items-center text-2xl font-black text-[#385144]">
              <Target className="mr-2 h-6 w-6 text-[#B8795C]" />
              После обучения вы сможете
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {TRAINING_RESULTS.map(result => (
                <div key={result} className="flex items-start rounded-2xl bg-[#F8F3EC] p-3 text-sm font-black text-[#385144]">
                  <Check className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[#B8795C]" />
                  {result}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {FIT_ITEMS.map(item => (
              <div key={item.title} className="rounded-[1.5rem] border border-white/80 bg-white/80 p-4 shadow-sm">
                <p className="mb-2 text-lg font-black text-[#385144]">{item.title}</p>
                <p className="text-xs font-semibold leading-relaxed text-[#657066]">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
        )}

        {!activeStudentEnrollment && enrollments.length > 0 && (
          <section className="mb-5 rounded-[1.8rem] border border-white/80 bg-white/82 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.10)]">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">мои заявки</p>
            <div className="space-y-3">
              {enrollments.slice(0, 2).map(enrollment => (
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

        {!activeStudentEnrollment && (
        <section className="space-y-4">
          {programs.map(program => {
            const programGroups = getProgramGroups(program.id);

            return (
              <article
                key={program.id}
                className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/86 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.10)]"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1EA] p-3 text-[#385144]">
                    {program.is_group ? <Users className="h-6 w-6" /> : <GraduationCap className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#B8795C]">
                      {program.is_group ? 'группа' : 'индивидуально'}
                    </p>
                    <h2 className="text-2xl font-black leading-tight text-[#385144]">{program.title}</h2>
                  </div>
                </div>

                <p className="mb-4 text-sm font-semibold leading-relaxed text-[#657066]">{program.description}</p>

                <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#F8F3EC] px-4 py-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9AA39B]">стоимость</p>
                    <p className="text-2xl font-black text-[#8A5A3F]">{getTrainingProgramPriceLabel(program)}</p>
                  </div>
                  <div className="text-right">
                    <Clock className="ml-auto mb-1 h-4 w-4 text-[#8A9B7B]" />
                    <p className="text-xs font-bold text-[#6C756C]">{program.duration_label}</p>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2">
                  {(program.includes || []).slice(0, 4).map(item => (
                    <div key={item} className="rounded-2xl bg-white px-3 py-3 text-xs font-black text-[#385144] ring-1 ring-[#385144]/8">
                      <Check className="mb-1 h-4 w-4 text-[#B8795C]" />
                      {item}
                    </div>
                  ))}
                </div>

                {program.is_group && (
                  <div className="mb-4 rounded-2xl border border-dashed border-[#B8795C]/35 bg-[#FFF9F0] p-4">
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#B8795C]">ближайшие группы</p>
                    {programGroups.length > 0 ? (
                      <div className="space-y-2">
                        {programGroups.slice(0, 2).map(group => {
                          const startsAt = getSafeDate(group.starts_at);
                          return (
                            <div key={group.id} className="flex items-center justify-between rounded-xl bg-white/76 px-3 py-2">
                              <div>
                                <p className="text-sm font-black text-[#385144]">{group.title}</p>
                                <p className="text-xs font-semibold text-[#6C756C]">
                                  {startsAt ? format(startsAt, 'd MMMM, HH:mm', { locale: ru }) : 'Дата уточняется'}
                                </p>
                              </div>
                              <span className="rounded-full bg-[#EAF1EA] px-3 py-1 text-xs font-black text-[#385144]">
                                {getGroupPlacesLeft(group)} мест
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-[#6C756C]">Набор группы скоро откроется. Можно оставить заявку заранее.</p>
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
        </section>
        )}
      </div>

      {selectedProgram && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/42 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitEnrollment}
            className="mx-auto w-full max-w-md rounded-[2rem] bg-[#F8F3EC] p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]">
                  {enrollmentKind === 'waitlist' ? 'лист ожидания' : 'обсуждение формата'}
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
                            selected
                              ? 'bg-[#385144] text-white'
                              : 'bg-[#F8F3EC] text-[#385144]'
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
