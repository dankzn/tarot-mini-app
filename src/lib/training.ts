export interface TrainingProgram {
  id: string;
  slug: string;
  title: string;
  format_type: string;
  description: string;
  price: number;
  duration_label?: string | null;
  includes?: string[] | null;
  is_group: boolean;
  is_active: boolean;
  has_certificate?: boolean | null;
  sort_order?: number | null;
}

export interface TrainingGroup {
  id: string;
  program_id: string;
  title: string;
  starts_at: string;
  capacity: number;
  status: string;
  notes?: string | null;
  taken?: number;
}

export interface TrainingEnrollment {
  id: string;
  user_id: string;
  program_id: string;
  group_id?: string | null;
  status: string;
  payment_status: string;
  final_price: number;
  original_price?: number | null;
  promo_code_id?: string | null;
  promo_code?: string | null;
  promo_discount?: number | null;
  preferred_start?: string | null;
  client_comment?: string | null;
  admin_notes?: string | null;
  certificate_required?: boolean | null;
  exam_status?: string | null;
  created_at: string;
  training_programs?: TrainingProgram | null;
  training_groups?: TrainingGroup | null;
  users?: any;
}

export interface TrainingLesson {
  id: string;
  group_id: string;
  title: string;
  description?: string | null;
  lesson_at?: string | null;
  homework_title?: string | null;
  homework_description?: string | null;
  sort_order: number;
}

export interface TrainingLessonProgress {
  id: string;
  lesson_id: string;
  enrollment_id: string;
  attended: boolean;
  attendance_status?: string | null;
  grade?: number | null;
  homework_status: string;
  homework_note?: string | null;
  homework_submitted_text?: string | null;
  homework_files?: TrainingHomeworkFile[] | null;
  homework_submitted_at?: string | null;
  homework_deadline_extended_until?: string | null;
  homework_unlocked_by_admin?: boolean | null;
}

export interface TrainingHomeworkFile {
  name: string;
  path: string;
  url?: string;
  size?: number;
  type?: string;
  storage?: 'supabase' | 'telegram';
  telegram_file_id?: string | null;
  telegram_message_id?: number | null;
}

export const DEFAULT_TRAINING_PROGRAMS: TrainingProgram[] = [
  {
    id: 'fallback-individual-basic',
    slug: 'individual-basic',
    title: 'Индивидуальное базовое обучение',
    format_type: 'individual',
    description: 'Личная база Таро с мягким темпом: структура колоды, чтение арканов, первые расклады и уверенная практика.',
    price: 20000,
    duration_label: '10 занятий',
    includes: ['10 занятий', 'Личная траектория', 'Практика на ваших вопросах', 'Поддержка между встречами'],
    is_group: false,
    is_active: true,
    sort_order: 10,
  },
  {
    id: 'fallback-individual-advanced',
    slug: 'individual-advanced',
    title: 'Индивидуальное расширенное обучение',
    format_type: 'individual',
    description: 'Глубокий формат для тех, кто хочет читать сложные запросы, видеть связки карт и собирать консультацию как систему.',
    price: 40000,
    duration_label: '14 занятий',
    includes: ['14 занятий', 'Расширенная практика', 'Этика консультаций', 'Разбор практики'],
    is_group: false,
    is_active: true,
    sort_order: 20,
  },
  {
    id: 'fallback-group-basic',
    slug: 'group-basic',
    title: 'Групповое базовое обучение',
    format_type: 'group',
    description: 'Камерная группа для бережного входа в Таро: база, практика, домашние задания и понятная структура обучения.',
    price: 11500,
    duration_label: '10 занятий',
    includes: ['10 занятий', 'Камерная группа', 'Домашние задания', 'Общий учебный ритм'],
    is_group: true,
    is_active: true,
    sort_order: 30,
  },
];

export const trainingStatusLabels: Record<string, string> = {
  pending: 'Заявка подана',
  details: 'Уточнение деталей',
  contract: 'Подписание договора',
  enrolled: 'Зачисление',
  learning: 'Обучение',
  completed: 'Курс завершён',
  expelled: 'Отчислен(а)',
  cancelled: 'Отменено',
  waitlist: 'Лист ожидания',
  diagnostic: 'Уточнение деталей',
  contacted: 'Уточнение деталей',
  awaiting_payment: 'Подписание договора',
};

export const trainingPaymentLabels: Record<string, string> = {
  not_requested: 'Оплату ещё не запрашивали',
  requested: 'Ожидает оплаты',
  marked_paid: 'Оплата на проверке',
  paid: 'Оплачено',
};

export const homeworkStatusLabels: Record<string, string> = {
  not_started: 'Не начато',
  assigned: 'Выдано',
  submitted: 'Сдано',
  accepted: 'Принято',
  revise: 'Нужна доработка',
  expired: 'Просрочено',
};

export const attendanceStatusLabels: Record<string, string> = {
  pending: 'Ожидает',
  attended: 'Был(а)',
  absent: 'н',
};

export const trainingGroupStatusLabels: Record<string, string> = {
  open: 'Набор открыт',
  full: 'Группа набрана',
  closed: 'Набор закрыт',
  started: 'Стартовала',
  completed: 'Завершена',
};

export const formatTrainingPrice = (price: number) => `${Number(price || 0).toLocaleString('ru-RU')} ₽`;

export const getTrainingProgramPriceLabel = (program: TrainingProgram) => (
  program.is_group
    ? `${formatTrainingPrice(program.price)} с человека`
    : formatTrainingPrice(program.price)
);

export const getTrainingProgramCta = (program: TrainingProgram, hasOpenGroup = false) => {
  if (program.is_group) {
    return hasOpenGroup ? 'Занять место в группе' : 'В лист ожидания';
  }

  return 'Обсудить формат';
};
