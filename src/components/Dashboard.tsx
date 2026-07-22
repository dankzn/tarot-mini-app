import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BookingForm } from './BookingForm';
import { ConsultationHistory } from './ConsultationHistory';
import { PrivilegeCards } from './PrivilegeCards';
import { InfoMenu } from './InfoMenu';
import { ReferralProgram } from './ReferralProgram';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { formatCountdown, getServicePriceState } from '../lib/serviceCampaigns';
import { getConsultationCycleDate, getCurrentLoyaltyCycleStart, getLoyaltyStatusByCompletedConsultations } from '../lib/bonusLogic';
import {
  Crown,
  Sparkles,
  ScrollText,
  Gift,
  CalendarCheck,
  Home,
  MapPin,
  Clock,
  ChevronRight,
  ArrowLeft,
  Menu,
  Camera,
  Eye,
  Leaf,
  UserCircle,
  Info,
  Flame,
  Heart,
  CreditCard,
  BookOpen
} from 'lucide-react';

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration_minutes?: number;
  next_price?: number | null;
  price_increase_at?: string | null;
  promo_title?: string | null;
  promo_price?: number | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
  category_id?: string | null;
  display_badge?: string | null;
  request_tags?: string[] | null;
  short_description?: string | null;
}

interface DashboardProps {
  user: any;
  onOpenTraining?: () => void;
}

interface DailyCard {
  name: string;
  arcana: string;
  focus: string;
  message: string;
}

interface QuizOption {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  durationPreference?: 'short' | 'long';
}

interface QuizQuestion {
  id: string;
  title: string;
  subtitle: string;
  options: QuizOption[];
}

type DashboardTab = 'home' | 'services' | 'cabinet' | 'menu';

type MiniPaymentStatus = {
  type: 'info' | 'success' | 'error';
  title: string;
  message: string;
  orderId?: string | null;
  bankStatus?: string | null;
  amount?: number | null;
  consultationId?: string | null;
};

const consultationStatusLabels: Record<string, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  needs_admin_time: 'Подбираем время',
  awaiting_client_confirmation: 'Подтвердите время',
  client_countered: 'Время предложено',
  in_progress: 'В процессе',
  awaiting_payment: 'Ожидает оплаты',
};

const consultationStatusColors: Record<string, string> = {
  pending: 'bg-[#F4E7C8] text-[#7A5A21]',
  confirmed: 'bg-[#DDE9E0] text-[#385144]',
  in_progress: 'bg-[#E7D8C9] text-[#8A5A3F]',
  awaiting_payment: 'bg-[#FFF1E8] text-[#8A5A3F]',
};

const getSafeDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getConsultationDateText = (consultation: any) => {
  const date = getSafeDate(consultation?.scheduled_at);
  if (date) return format(date, 'd MMMM', { locale: ru });
  if (consultation?.requested_date) return 'Подбирается';
  return 'Не назначена';
};

const getConsultationTimeText = (consultation: any) => {
  const date = getSafeDate(consultation?.scheduled_at);
  if (date) return format(date, 'HH:mm');
  if (consultation?.scheduling_status === 'awaiting_client_confirmation') return 'Ждёт ответа';
  if (consultation?.scheduling_status === 'client_countered') return 'Предложено';
  return 'Ждём предложения';
};

const getConsultationStatusText = (consultation: any) => (
  consultationStatusLabels[consultation?.scheduling_status] ||
  consultationStatusLabels[consultation?.status] ||
  consultation?.status
);

const getPaymentStatusText = (consultation: any) => {
  if (consultation?.payment_status === 'marked_paid') return 'Оплата на проверке';
  if (consultation?.payment_status === 'opened') return 'Ссылка открыта';
  if (consultation?.status === 'awaiting_payment') return 'Ожидает оплаты';
  return 'Можно оплатить заранее';
};

const getConsultationPaymentAmount = (consultation: any) => (
  Number(consultation?.payment_amount ?? consultation?.price ?? 0) || 0
);

const getConsultationsPaymentTotal = (consultations: any[] = []) => (
  consultations.reduce((sum, consultation) => sum + getConsultationPaymentAmount(consultation), 0)
);

const getConsultationsPaymentTitle = (consultations: any[] = []) => {
  if (consultations.length === 0) return 'Консультация';
  if (consultations.length === 1) return consultations[0]?.services?.title || 'Консультация';

  const titles = consultations
    .map((consultation) => consultation?.services?.title)
    .filter(Boolean);

  return `${consultations.length} консультации: ${titles.join(', ') || 'выбранные форматы'}`;
};

const getConsultationsPaymentDateText = (consultations: any[] = []) => {
  if (consultations.length === 0) return 'Не назначена';
  const dates = Array.from(new Set(consultations.map(getConsultationDateText)));
  return dates.length === 1 ? dates[0] : 'Несколько дат';
};

const getConsultationsPaymentTimeText = (consultations: any[] = []) => {
  if (consultations.length === 0) return 'Ждём предложения';
  const times = Array.from(new Set(consultations.map(getConsultationTimeText)));
  return times.length === 1 ? times[0] : 'Несколько времён';
};

const STATUS_MILESTONES = [
  { name: 'Первое знакомство', consultations: 0 },
  { name: 'Basic', consultations: 1 },
  { name: 'Silver', consultations: 3 },
  { name: 'Gold', consultations: 6 },
  { name: 'Platinum', consultations: 11 },
];

const DAILY_CARDS: DailyCard[] = [
  {
    name: 'Маг',
    arcana: 'I аркан',
    focus: 'Инициатива',
    message: 'Сегодня лучше не ждать идеального момента, а мягко начать с первого точного действия.',
  },
  {
    name: 'Жрица',
    arcana: 'II аркан',
    focus: 'Интуиция',
    message: 'Ответ уже ближе, чем кажется. Оставьте пространство тишине и не спорьте с внутренним знанием.',
  },
  {
    name: 'Императрица',
    arcana: 'III аркан',
    focus: 'Забота',
    message: 'День просит телесности, красоты и бережного отношения к себе. Не обесценивайте простые радости.',
  },
  {
    name: 'Колесница',
    arcana: 'VII аркан',
    focus: 'Движение',
    message: 'Важен не рывок, а управление. Выберите направление и не распыляйтесь на чужие маршруты.',
  },
  {
    name: 'Сила',
    arcana: 'VIII аркан',
    focus: 'Мягкая власть',
    message: 'Сегодня работает спокойная уверенность. Не давите — ведите ситуацию через выдержку.',
  },
  {
    name: 'Отшельник',
    arcana: 'IX аркан',
    focus: 'Ясность',
    message: 'Полезно сократить шум и услышать собственную позицию. Не каждый ответ должен быть быстрым.',
  },
  {
    name: 'Звезда',
    arcana: 'XVII аркан',
    focus: 'Восстановление',
    message: 'День возвращает веру в себя маленькими знаками. Поддержите то, что внутри ещё светится.',
  },
  {
    name: 'Солнце',
    arcana: 'XIX аркан',
    focus: 'Открытость',
    message: 'Не прячьте радость и результат. Сегодня честная проявленность сильнее идеальной стратегии.',
  },
];

const ONBOARDING_CARDS = [
  {
    title: 'Сначала — бережно',
    text: 'Вы выбираете формат и удобное время, а после заявки я подтверждаю детали лично.',
  },
  {
    title: 'Без лишнего шума',
    text: 'В консультации фокус на ясности, возможных сценариях и спокойных следующих шагах.',
  },
  {
    title: 'Личное остаётся личным',
    text: 'Можно говорить прямо: без осуждения, давления и “страшных прогнозов”.',
  },
];

const SERVICE_QUIZ: QuizQuestion[] = [
  {
    id: 'request',
    title: 'Что сейчас важнее всего?',
    subtitle: 'Выберите самый близкий запрос — без идеальной формулировки.',
    options: [
      {
        id: 'relationships',
        label: 'Отношения и чувства',
        description: 'Понять динамику, намерения, перспективу контакта.',
        keywords: ['отнош', 'люб', 'чувств', 'партнер', 'партнёр', 'личн'],
      },
      {
        id: 'choice',
        label: 'Выбор или развилка',
        description: 'Сравнить варианты и увидеть последствия решений.',
        keywords: ['выбор', 'решен', 'вариант', 'развилк', 'ситуац'],
      },
      {
        id: 'self',
        label: 'Состояние и опора',
        description: 'Вернуть ясность, ресурс и контакт с собой.',
        keywords: ['себ', 'состоя', 'ресурс', 'путь', 'личн'],
      },
    ],
  },
  {
    id: 'depth',
    title: 'Насколько глубоко разбираем?',
    subtitle: 'Это поможет не переплачивать за лишний формат.',
    options: [
      {
        id: 'soft',
        label: 'Быстро сориентироваться',
        description: 'Нужен аккуратный прогноз или первая подсказка.',
        keywords: ['карта', 'дня', 'мини', 'экспресс', 'прогноз'],
        durationPreference: 'short',
      },
      {
        id: 'classic',
        label: 'Полноценный разбор',
        description: 'Хочу структуру, детали и понятные следующие шаги.',
        keywords: ['консультац', 'разбор', 'расклад', 'базов'],
      },
      {
        id: 'deep',
        label: 'Глубоко и обстоятельно',
        description: 'Запрос сложный, хочется разобрать несколько слоёв.',
        keywords: ['глуб', 'полноцен', 'веден', 'сопровожд', 'сложн'],
        durationPreference: 'long',
      },
    ],
  },
  {
    id: 'tempo',
    title: 'Какой темп вам сейчас подходит?',
    subtitle: 'Подберём формат под ваше состояние, а не наоборот.',
    options: [
      {
        id: 'today',
        label: 'Мягко и на сегодня',
        description: 'Без перегруза, но с ясным ориентиром.',
        keywords: ['день', 'прогноз', 'карта', 'мини'],
        durationPreference: 'short',
      },
      {
        id: 'soon',
        label: 'Спокойно, но подробно',
        description: 'Нужно время на разговор и нормальный контекст.',
        keywords: ['консультац', 'расклад', 'разбор'],
      },
      {
        id: 'longterm',
        label: 'Хочу сопровождение',
        description: 'Есть тема, к которой важно возвращаться.',
        keywords: ['веден', 'сопровожд', 'личн', 'долг'],
        durationPreference: 'long',
      },
    ],
  },
];

const getStatusProgress = (currentStatus: string, totalConsultations: number) => {
  const currentIndex = Math.max(
    STATUS_MILESTONES.findIndex((status) => status.name === currentStatus),
    0
  );
  const current = STATUS_MILESTONES[currentIndex];
  const next = STATUS_MILESTONES[currentIndex + 1];

  if (!next) {
    return {
      label: 'Максимальный уровень заботы открыт',
      progress: 100,
      remaining: 0,
    };
  }

  const consultationsInLevel = Math.max(totalConsultations - current.consultations, 0);
  const consultationsNeeded = next.consultations - current.consultations;
  const remaining = Math.max(next.consultations - totalConsultations, 0);

  return {
    label: `До ${next.name}: ${remaining} ${remaining === 1 ? 'консультация' : 'консультации'}`,
    progress: Math.min(Math.round((consultationsInLevel / consultationsNeeded) * 100), 100),
    remaining,
  };
};

const getServiceBadge = (service: Service, index: number) => {
  if (service.display_badge) return service.display_badge;

  const title = service.title.toLowerCase();

  if (title.includes('карта') || title.includes('new')) return 'Новый формат';
  if (index === 0) return 'Мягкий вход';
  if (service.duration_minutes && service.duration_minutes >= 90) return 'Глубокий разбор';
  if (service.price >= 3000) return 'Для сложного запроса';

  return 'Индивидуально';
};

const isDailyCardService = (text: string) => (
  text.includes('карта дня') || text.includes('картой дня') || text.includes('на день')
);

const isDailyCardServiceItem = (service: Service) => (
  isDailyCardService(`${service.title} ${service.description || ''}`.toLowerCase())
);

const getServiceBenefits = (service: Service) => {
  const text = `${service.title} ${service.description || ''}`.toLowerCase();
  const benefits = new Set<string>();

  if (text.includes('отнош') || text.includes('люб') || text.includes('чувств')) {
    benefits.add('прояснить чувства');
    benefits.add('увидеть динамику');
  }

  if (isDailyCardService(text)) {
    benefits.add('быстрый ориентир');
    benefits.add('мягкий фокус на день');
  }

  if (text.includes('глуб') || text.includes('разбор') || text.includes('расклад') || text.includes('базов')) {
    benefits.add('разобрать слои ситуации');
    benefits.add('собрать план действий');
  }

  if (text.includes('веден') || text.includes('сопровожд')) {
    benefits.add('двигаться постепенно');
    benefits.add('держать опору в процессе');
  }

  benefits.add(service.duration_minutes && service.duration_minutes <= 45 ? 'без перегруза' : 'с вниманием к деталям');

  return Array.from(benefits).slice(0, 3);
};

const getServiceOutcome = (service: Service) => {
  const text = `${service.title} ${service.description || ''}`.toLowerCase();

  if (text.includes('отнош') || text.includes('люб') || text.includes('чувств')) {
    return 'Подойдёт, если хочется понять контакт, намерения и возможную траекторию отношений.';
  }

  if (isDailyCardService(text)) {
    return 'Подойдёт, если нужен быстрый, аккуратный ориентир без большого разбора.';
  }

  if (text.includes('базов') || text.includes('расклад')) {
    return 'Подойдёт для полноценного базового разбора: увидеть структуру ситуации, важные влияния и ближайшие шаги.';
  }

  if (text.includes('веден') || text.includes('сопровожд')) {
    return 'Подойдёт, если тема требует не одного ответа, а спокойного движения рядом.';
  }

  return 'Подойдёт для честного разбора ситуации и понятных следующих шагов.';
};

const getServiceAccent = (index: number) => {
  const accents = [
    'from-[#F7F0E7] via-white to-[#EEF3EE]',
    'from-[#EEF3EE] via-white to-[#F3E8DA]',
    'from-[#F7EFE8] via-white to-[#E8EFE7]',
  ];

  return accents[index % accents.length];
};

const SERVICE_GROUPS = [
  {
    id: 'daily',
    title: 'Ежедневный ориентир',
    subtitle: 'Короткий прогноз на день без привязки к отношениям, работе или сложному запросу',
    keywords: ['карта дня', 'картой дня', 'на день', 'мини', 'экспресс'],
    excludeKeywords: ['базов', 'расклад', 'консультац'],
  },
  {
    id: 'quick',
    title: 'Быстрый ориентир',
    subtitle: 'Когда нужен мягкий ответ без длинного разбора, но запрос всё же про конкретную ситуацию',
    keywords: ['мини', 'экспресс', 'прогноз'],
    excludeKeywords: ['карта дня', 'картой дня', 'на день', 'базов', 'расклад', 'консультац'],
  },
  {
    id: 'relationships',
    title: 'Отношения и чувства',
    subtitle: 'Динамика контакта, намерения, перспективы',
    keywords: ['отнош', 'люб', 'чувств', 'партнер', 'партнёр', 'личн'],
    excludeKeywords: [],
  },
  {
    id: 'deep',
    title: 'Расклады и разборы',
    subtitle: 'Базовые и глубокие форматы для полноценного понимания ситуации',
    keywords: ['базов', 'глуб', 'разбор', 'расклад', 'полноцен', 'сложн'],
    excludeKeywords: [],
  },
  {
    id: 'support',
    title: 'Сопровождение',
    subtitle: 'Когда важно возвращаться к теме и идти постепенно',
    keywords: ['веден', 'сопровожд', 'долг', 'путь'],
    excludeKeywords: [],
  },
];

const getGroupedServices = (services: Service[]) => {
  const usedIds = new Set<string>();
  const normalizedServices = services.map(service => ({
    service,
    text: `${service.title} ${service.description || ''}`.toLowerCase(),
  }));

  const groups = SERVICE_GROUPS.map(group => {
    const items = normalizedServices
      .filter(({ service, text }) => {
        const hasManualCategory = service.category_id === group.id;
        const hasKeyword = group.keywords.some(keyword => text.includes(keyword));
        const hasExcludedKeyword = group.excludeKeywords.some(keyword => text.includes(keyword));

        return !usedIds.has(service.id) && (hasManualCategory || (hasKeyword && !hasExcludedKeyword));
      })
      .map(({ service }) => service);

    items.forEach(service => usedIds.add(service.id));

    return {
      ...group,
      services: items,
    };
  }).filter(group => group.services.length > 0);

  const otherServices = services.filter(service => !usedIds.has(service.id));

  if (otherServices.length > 0) {
    groups.push({
      id: 'other',
      title: 'Индивидуальные форматы',
      subtitle: 'Дополнительные варианты под нестандартный запрос',
      keywords: [],
      excludeKeywords: [],
      services: otherServices,
    });
  }

  return groups;
};

const getDailyCardDateKey = () => new Date().toISOString().slice(0, 10);

const getDailyCard = (seed: string): DailyCard => {
  const dateKey = getDailyCardDateKey();
  const hash = `${seed}-${dateKey}`.split('').reduce((acc, char) => (
    (acc * 31 + char.charCodeAt(0)) % 9973
  ), 7);

  return DAILY_CARDS[hash % DAILY_CARDS.length];
};

const getServiceRecommendations = (services: Service[], selectedOptions: QuizOption[]) => {
  if (services.length === 0) return [];

  const thematicServices = services.filter(service => !isDailyCardServiceItem(service));
  const scoredServices = thematicServices.map((service) => {
    const title = service.title.toLowerCase();
    const description = (service.description || '').toLowerCase();
    const serviceText = `${title} ${description}`;

    const score = selectedOptions.reduce((sum, option) => {
      const keywordScore = option.keywords.reduce((keywordSum, keyword) => (
        keywordSum + (serviceText.includes(keyword) ? 3 : 0)
      ), 0);
      const duration = service.duration_minutes || 60;
      const durationScore =
        option.durationPreference === 'short' && duration <= 45 ? 2 :
        option.durationPreference === 'long' && duration >= 90 ? 2 :
        0;

      return sum + keywordScore + durationScore;
    }, 0);

    return { service, score };
  });

  return scoredServices.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.service.price || 0) - (b.service.price || 0);
  }).map(({ service }) => service);
};

export const Dashboard = ({ user, onOpenTraining }: DashboardProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showBonusInfo, setShowBonusInfo] = useState(false);
  const [showPrivileges, setShowPrivileges] = useState(false);
  const [showInfoMenu, setShowInfoMenu] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [showServiceQuiz, setShowServiceQuiz] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, QuizOption>>({});
  const [selectedServiceGroupId, setSelectedServiceGroupId] = useState<string | null>(null);
  const [serviceDetails, setServiceDetails] = useState<Service | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [clockNow, setClockNow] = useState(() => new Date());
  const [bonusHistory, setBonusHistory] = useState<any[]>([]);
  const [totalConsultations, setTotalConsultations] = useState(0);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [upcomingConsultation, setUpcomingConsultation] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentDueConsultation, setPaymentDueConsultation] = useState<any>(null);
  const [paymentDueConsultations, setPaymentDueConsultations] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [miniPaymentStatus, setMiniPaymentStatus] = useState<MiniPaymentStatus | null>(null);
  const onboardingStorageKey = `tarot-onboarding-seen:${user.id || user.telegram_id || 'guest'}`;
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return window.localStorage.getItem(onboardingStorageKey) !== 'yes';
    } catch {
      return false;
    }
  });
  const dailyCardSeed = String(user.telegram_id || user.id || user.name || 'guest');
  const dailyCard = getDailyCard(dailyCardSeed);
  const dailyCardStorageKey = `tarot-daily-card:${dailyCardSeed}:${getDailyCardDateKey()}`;
  const [isDailyCardOpen, setIsDailyCardOpen] = useState(() => {
    try {
      return window.localStorage.getItem(dailyCardStorageKey) === 'open';
    } catch {
      return false;
    }
  });
  const favoriteServicesStorageKey = `tarot-favorite-services:${user.id || user.telegram_id || 'guest'}`;
  const [favoriteServiceIds, setFavoriteServiceIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(favoriteServicesStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    loadServices();
    loadBonusHistory();
    loadTotalConsultations();
    loadUpcomingConsultation();
    loadPaymentMethods();
    loadPaymentDueConsultation();
    loadProfilePhoto();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const loadServices = async () => {
    try {
      await supabase.rpc('apply_due_service_price_changes');

      const { data } = await supabase
        .from('services')
        .select('*')
        .order('price', { ascending: true });

      if (data) {
        setServices(data);
      }
    } catch (err) {
      console.error('Ошибка:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBonusHistory = async () => {
    const { data } = await supabase
      .from('consultations')
      .select('id, created_at, bonus_paid, bonus_used, price, services(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setBonusHistory(data);
    }
  };

  const loadTotalConsultations = async () => {
    const cycleStart = getCurrentLoyaltyCycleStart();
    const { data } = await supabase
      .from('consultations')
      .select('completed_at, scheduled_at, created_at')
      .eq('user_id', user.id)
      .eq('status', 'completed');

    const count = (data || []).filter((consultation) => {
      const consultationDate = getConsultationCycleDate(consultation);
      return consultationDate && consultationDate >= cycleStart;
    }).length;

    setTotalConsultations(count);
  };

  const loadUpcomingConsultation = async () => {
    const { data, error } = await supabase
      .from('consultations')
        .select('id, scheduled_at, requested_date, scheduling_status, client_time_counterproposal, status, price, payment_status, payment_amount, priority_fee, bonus_used, services(title, duration_minutes)')
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed', 'in_progress', 'awaiting_payment'])
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Ошибка загрузки ближайшей консультации:', error);
      setUpcomingConsultation(null);
      return;
    }

    const now = Date.now();
    const activeConsultations = data || [];
    const nextConsultation = activeConsultations.find((consultation) => (
      consultation.scheduled_at && new Date(consultation.scheduled_at).getTime() >= now
    ));
    const latestActiveConsultation = activeConsultations[activeConsultations.length - 1] || null;

    setUpcomingConsultation(nextConsultation || latestActiveConsultation);
  };

  const loadPaymentMethods = async () => {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(5);

    if (error) {
      console.error('Ошибка загрузки способов оплаты:', error);
      setPaymentMethods([]);
      return;
    }

    setPaymentMethods(data || []);
  };

  const loadPaymentDueConsultation = async () => {
    const { data, error } = await supabase
      .from('consultations')
      .select('id, scheduled_at, requested_date, requested_time_text, scheduling_status, status, payment_status, payment_amount, price, services(title)')
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed', 'awaiting_payment'])
      .in('payment_status', ['unpaid', 'payment_requested', 'opened', 'marked_paid'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка загрузки оплаты:', error);
      setPaymentDueConsultation(null);
      setPaymentDueConsultations([]);
      return;
    }

    const dueConsultations = data || [];
    const latestConsultation = dueConsultations[0] || null;
    const payableConsultations = dueConsultations.filter((consultation) => consultation.payment_status !== 'marked_paid');

    setPaymentDueConsultations(dueConsultations);
    setPaymentDueConsultation(latestConsultation);
    setShowPaymentModal(payableConsultations.some((consultation) => consultation.status === 'awaiting_payment'));

    if (payableConsultations.length > 0) {
      const paymentKey = getMiniPaymentBatchKey(payableConsultations);
      const savedOrderId = window.localStorage.getItem(getMiniPaymentOrderKey(paymentKey));
      if (savedOrderId) {
        pollMiniPaymentStatus(savedOrderId, paymentKey);
      }
    }
  };

  const primaryPaymentMethod = paymentMethods[0] || null;
  const payablePaymentDueConsultations = paymentDueConsultations.filter((consultation) => consultation.payment_status !== 'marked_paid');
  const displayPaymentDueConsultations = payablePaymentDueConsultations.length > 0
    ? payablePaymentDueConsultations
    : paymentDueConsultations;
  const paymentDueTotal = getConsultationsPaymentTotal(displayPaymentDueConsultations);
  const paymentDueIsMarkedPaid = paymentDueConsultations.length > 0 && paymentDueConsultations.every(
    (consultation) => consultation.payment_status === 'marked_paid',
  );

  const getMiniPaymentBatchKey = (consultations: any[] = []) => {
    const ids = consultations
      .map((consultation) => consultation?.id)
      .filter(Boolean)
      .sort();

    return ids.length > 0 ? ids.join(':') : 'empty';
  };

  const getMiniPaymentOrderKey = (paymentKey: string) => `tarot-mini-tbank-order:${paymentKey}`;

  const pollMiniPaymentStatus = async (orderId: string, paymentKey: string, attempt = 0) => {
    try {
      const response = await fetch(`/api/site/tbank-status?order=${encodeURIComponent(orderId)}`, {
        credentials: 'include',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Не удалось получить статус оплаты');
      }

      if (payload.paymentState === 'paid') {
        window.localStorage.removeItem(getMiniPaymentOrderKey(paymentKey));
        setMiniPaymentStatus({
          type: 'success',
          title: payload.title || 'Оплата прошла',
          message: 'Банк подтвердил платёж. Бот отправит дальнейшие шаги и контакт @dan_kzn',
          orderId: payload.orderId,
          bankStatus: payload.bankStatus,
          amount: payload.amount,
          consultationId: paymentKey,
        });
        setShowPaymentModal(false);
        await loadPaymentDueConsultation();
        await loadUpcomingConsultation();
        return;
      }

      if (payload.paymentState === 'failed') {
        window.localStorage.removeItem(getMiniPaymentOrderKey(paymentKey));
        setMiniPaymentStatus({
          type: 'error',
          title: payload.title || 'Оплата не прошла',
          message: payload.message || 'Банк не одобрил оплату',
          orderId: payload.orderId,
          bankStatus: payload.bankStatus,
          amount: payload.amount,
          consultationId: paymentKey,
        });
        return;
      }

      setMiniPaymentStatus({
        type: 'info',
        title: payload.title || 'Платёж обрабатывается',
        message: 'Жду финальный ответ банка и обновляю статус автоматически',
        orderId: payload.orderId,
        bankStatus: payload.bankStatus,
        amount: payload.amount,
        consultationId: paymentKey,
      });

      if (attempt < 30) {
        window.setTimeout(() => pollMiniPaymentStatus(orderId, paymentKey, attempt + 1), attempt < 5 ? 3000 : 6000);
      }
    } catch (error: any) {
      setMiniPaymentStatus({
        type: 'info',
        title: 'Проверяю оплату',
        message: error?.message || 'Статус обновится автоматически чуть позже',
        orderId,
        consultationId: paymentKey,
      });

      if (attempt < 30) {
        window.setTimeout(() => pollMiniPaymentStatus(orderId, paymentKey, attempt + 1), attempt < 5 ? 3000 : 6000);
      }
    }
  };

  const openPaymentLink = async (consultationOrConsultations: any | any[] = paymentDueConsultations.length > 0 ? paymentDueConsultations : paymentDueConsultation) => {
    const consultations = (Array.isArray(consultationOrConsultations) ? consultationOrConsultations : [consultationOrConsultations])
      .filter((consultation) => consultation?.id && consultation.payment_status !== 'marked_paid');

    if (consultations.length === 0 || paymentBusy) return;

    const paymentKey = getMiniPaymentBatchKey(consultations);

    const telegramInitData = (window.Telegram?.WebApp as any)?.initData || '';
    if (!telegramInitData) {
      alert('Не удалось подтвердить Telegram-сессию. Откройте приложение заново из Telegram.');
      return;
    }

    setPaymentBusy(true);
    setMiniPaymentStatus({
      type: 'info',
      title: 'Создаю платёж',
      message: 'Передаю заказ в Т-Банк',
      amount: getConsultationsPaymentTotal(consultations),
      consultationId: paymentKey,
    });

    try {
      const response = await fetch('/api/site/tbank-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          telegramInitData,
          telegramUserId: user.telegram_id,
          userId: user.id,
          cart: consultations.map((consultation) => ({
            id: `consultation:${consultation.id}`,
            source: 'consultation',
          })),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload.paymentUrl) {
        throw new Error(payload?.error || 'Не удалось создать оплату');
      }

      await supabase
        .from('consultations')
        .update({
          payment_status: 'opened',
          payment_method_id: primaryPaymentMethod?.id || null,
        })
        .in('id', consultations.map((consultation) => consultation.id));

      window.localStorage.setItem(getMiniPaymentOrderKey(paymentKey), payload.orderId);
      setMiniPaymentStatus({
        type: 'info',
        title: 'Платёж создан',
        message: 'После оплаты банк пришлёт подтверждение, а бот отправит дальнейшие шаги и @dan_kzn',
        orderId: payload.orderId,
        amount: payload.amount,
        consultationId: paymentKey,
      });
      pollMiniPaymentStatus(payload.orderId, paymentKey);

      const telegramWebApp = window.Telegram?.WebApp as any;
      telegramWebApp?.openLink?.(payload.paymentUrl);
      if (!telegramWebApp?.openLink) {
        window.open(payload.paymentUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error: any) {
      setMiniPaymentStatus({
        type: 'error',
        title: 'Оплата не создана',
        message: error?.message || 'Не удалось создать оплату',
        amount: getConsultationsPaymentTotal(consultations),
        consultationId: paymentKey,
      });
      alert(error?.message || 'Не удалось создать оплату');
    } finally {
      setPaymentBusy(false);
    }
  };

  const loadProfilePhoto = () => {
    // Сначала проверяем Telegram avatar
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.photo_url) {
      setProfilePhoto(tg.initDataUnsafe.user.photo_url);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      await supabase
        .from('users')
        .update({ profile_photo: publicUrl })
        .eq('id', user.id);

      setProfilePhoto(publicUrl);
      alert('✅ Фото профиля обновлено!');
    } catch (error: any) {
      alert('Ошибка загрузки фото: ' + error.message);
    }
  };

  const statusColors: Record<string, string> = {
    'Первое знакомство': 'bg-[#ECE7DF] text-[#5E675D]',
    'Basic': 'bg-[#E1ECE5] text-[#385144]',
    'Silver': 'bg-[#ECEFF0] text-[#5B6464]',
    'Gold': 'bg-[#F1E3C4] text-[#7A5A21]',
    'Platinum': 'bg-[#E8DED2] text-[#8A5A3F]',
  };

  const currentStatus = user.status === 'Личное ведение'
    ? getLoyaltyStatusByCompletedConsultations(totalConsultations)
    : user.status || 'Первое знакомство';
  const statusColor = statusColors[currentStatus] || statusColors['Первое знакомство'];
  const statusProgress = getStatusProgress(currentStatus, totalConsultations);
  const personalTarologistUntil = user.personal_tarologist_until ? new Date(user.personal_tarologist_until) : null;
  const hasActivePersonalTarologist = Boolean(personalTarologistUntil && personalTarologistUntil >= new Date());
  const selectedQuizOptions = Object.values(quizAnswers);
  const recommendedServices = getServiceRecommendations(services, selectedQuizOptions);
  const recommendedService = recommendedServices[0] || null;
  const alternativeServices = recommendedServices.filter(service => service.id !== recommendedService?.id).slice(0, 2);
  const serviceGroups = getGroupedServices(services);
  const selectedServiceGroup = serviceGroups.find(group => group.id === selectedServiceGroupId) || null;
  const favoriteServices = services.filter(service => favoriteServiceIds.includes(service.id));
  const campaignServices = services.filter(service => {
    const priceState = getServicePriceState(service, clockNow);
    return Boolean(priceState.countdownTarget);
  }).slice(0, 2);

  const revealDailyCard = () => {
    try {
      window.localStorage.setItem(dailyCardStorageKey, 'open');
    } catch {
      // localStorage может быть недоступен внутри некоторых WebView
    }

    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    setIsDailyCardOpen(true);
  };

  const toggleFavoriteService = (serviceId: string) => {
    setFavoriteServiceIds((current) => {
      const next = current.includes(serviceId)
        ? current.filter(id => id !== serviceId)
        : [...current, serviceId];

      try {
        window.localStorage.setItem(favoriteServicesStorageKey, JSON.stringify(next));
      } catch {
        // localStorage может быть недоступен внутри некоторых WebView
      }

      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      return next;
    });
  };

  const selectQuizOption = (question: QuizQuestion, option: QuizOption) => {
    const nextAnswers = {
      ...quizAnswers,
      [question.id]: option,
    };

    setQuizAnswers(nextAnswers);

    if (quizStep < SERVICE_QUIZ.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    }
  };

  const resetQuiz = () => {
    setQuizStep(0);
    setQuizAnswers({});
  };

  const closeOnboarding = () => {
    try {
      window.localStorage.setItem(onboardingStorageKey, 'yes');
    } catch {
      // localStorage может быть недоступен внутри некоторых WebView
    }

    setShowOnboarding(false);
  };

  const bookRecommendedService = () => {
    if (!recommendedService) return;

    setSelectedService(recommendedService);
    setShowServiceQuiz(false);
    setShowBooking(true);
  };

  if (showBooking && selectedService) {
    return (
      <BookingForm
        user={user}
        service={selectedService}
        onSuccess={() => {
          setShowBooking(false);
          setSelectedService(null);
          loadUpcomingConsultation();
          loadPaymentDueConsultation();
          alert('✅ Заявка отправлена! Я свяжусь с вами для подтверждения.');
        }}
        onCancel={() => {
          setShowBooking(false);
          setSelectedService(null);
        }}
      />
    );
  }

  if (showHistory) {
    return (
      <ConsultationHistory
        user={user}
        onBack={() => setShowHistory(false)}
        onRebook={(service) => {
          setShowHistory(false);
          setSelectedService(service);
          setShowBooking(true);
        }}
      />
    );
  }

  if (showServiceQuiz) {
    const currentQuestion = SERVICE_QUIZ[quizStep];
    const isComplete = selectedQuizOptions.length === SERVICE_QUIZ.length;

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_42%,#EFE6DA_100%)] p-4 text-[#2F463B]">
        <div className="mx-auto max-w-xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">
                service concierge
              </p>
              <h2 className="text-2xl font-black text-[#385144]">Подбор формата</h2>
            </div>
            <button
              onClick={() => {
                setShowServiceQuiz(false);
                resetQuiz();
              }}
              className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-black text-[#5E675D] shadow-sm"
            >
              Закрыть
            </button>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2">
            {SERVICE_QUIZ.map((question, index) => {
              const isActive = index === quizStep && !isComplete;
              const isDone = Boolean(quizAnswers[question.id]);

              return (
                <div
                  key={question.id}
                  className={`h-2 rounded-full transition ${
                    isDone || isActive ? 'bg-[#385144]' : 'bg-white/75'
                  }`}
                />
              );
            })}
          </div>

          {isComplete && !recommendedService ? (
            <div className="rounded-[2rem] border border-white/80 bg-white/80 p-5 text-center shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
              <p className="mb-2 text-2xl font-black text-[#385144]">Пока не из чего выбрать</p>
              <p className="mb-5 text-sm leading-relaxed text-[#59645C]">
                Услуги ещё загружаются или не добавлены. Вернитесь к каталогу и попробуйте чуть позже.
              </p>
              <button
                onClick={() => {
                  setShowServiceQuiz(false);
                  resetQuiz();
                }}
                className="rounded-2xl bg-[#385144] px-5 py-3 font-black text-white"
              >
                Вернуться
              </button>
            </div>
          ) : isComplete && recommendedService ? (
            <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-gradient-to-br from-[#FFF9F0] via-white to-[#EAF1EA] p-5 shadow-[0_20px_50px_rgba(56,81,68,0.14)]">
              <div className="mb-5 rounded-[1.5rem] bg-[#385144] p-5 text-white">
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-white/65">
                  рекомендация
                </p>
                <h3 className="text-2xl font-black leading-tight">
                  {recommendedService.title}
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold">
                    {recommendedService.duration_minutes ? `${recommendedService.duration_minutes} минут` : 'Индивидуально'}
                  </span>
                  <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold">
                    {getServicePriceState(recommendedService, clockNow).currentPrice} ₽
                  </span>
                </div>
              </div>

              {recommendedService.description && (
                <p className="mb-5 text-sm leading-relaxed text-[#59645C]">
                  {recommendedService.description}
                </p>
              )}

              <div className="mb-5 rounded-2xl border border-[#385144]/10 bg-white/75 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8A5A3F]/70">
                  что получите
                </p>
                <p className="text-sm leading-relaxed text-[#59645C]">
                  {getServiceOutcome(recommendedService)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {getServiceBenefits(recommendedService).map((benefit) => (
                    <span
                      key={benefit}
                      className="rounded-full bg-[#EAF1EA] px-3 py-1 text-xs font-black text-[#385144]"
                    >
                      {benefit}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mb-5 rounded-2xl bg-white/75 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#8A5A3F]/70">
                  почему подходит
                </p>
                <div className="space-y-2">
                  {selectedQuizOptions.map((option) => (
                    <div key={option.id} className="flex items-start gap-2 text-sm text-[#59645C]">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#B8795C]" />
                      <span>{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {alternativeServices.length > 0 && (
                <div className="mb-5">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#8A5A3F]/70">
                    ещё могут подойти
                  </p>
                  <div className="grid gap-2">
                    {alternativeServices.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => {
                          setSelectedService(service);
                          setShowServiceQuiz(false);
                          setShowBooking(true);
                        }}
                        className="flex items-center justify-between rounded-2xl border border-[#385144]/10 bg-white/70 p-3 text-left transition hover:border-[#385144]/25 hover:bg-white"
                      >
                        <span>
                          <span className="block text-sm font-black text-[#385144]">{service.title}</span>
                          <span className="mt-0.5 block text-xs text-[#6C756C]">
                            {service.duration_minutes ? `${service.duration_minutes} минут` : 'Индивидуально'} · {getServicePriceState(service, clockNow).currentPrice} ₽
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-[#8FA092]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={resetQuiz}
                  className="flex-1 rounded-2xl bg-white/80 px-4 py-3 font-black text-[#385144]"
                >
                  Пройти заново
                </button>
                <button
                  onClick={bookRecommendedService}
                  className="flex-1 rounded-2xl bg-[#385144] px-4 py-3 font-black text-white shadow-[0_12px_28px_rgba(56,81,68,0.20)]"
                >
                  Записаться
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8A5A3F]/70">
                вопрос {quizStep + 1} из {SERVICE_QUIZ.length}
              </p>
              <h3 className="mb-2 text-2xl font-black leading-tight text-[#385144]">
                {currentQuestion.title}
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-[#59645C]">
                {currentQuestion.subtitle}
              </p>

              <div className="space-y-3">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => selectQuizOption(currentQuestion, option)}
                    className="w-full rounded-[1.35rem] border border-[#385144]/10 bg-[#F8F3EC] p-4 text-left transition hover:border-[#385144]/25 hover:bg-white"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="font-black text-[#385144]">{option.label}</span>
                      <ChevronRight className="h-4 w-4 text-[#8FA092]" />
                    </div>
                    <p className="text-sm leading-relaxed text-[#6C756C]">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showBonusInfo) {
    return (
      <div className="min-h-screen bg-[#F8F5F2] p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#385144] flex items-center">
            <Sparkles className="w-6 h-6 mr-2" />
            История бонусов
          </h2>
          <button onClick={() => setShowBonusInfo(false)} className="text-gray-500 hover:text-[#385144]">
            <span className="text-2xl">×</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600">Текущий баланс:</span>
            <span className="text-[#8A5A3F] font-bold text-2xl">{user.bonus_balance || 0} ₽</span>
          </div>
          <p className="text-gray-500 text-xs">Кэшбэк 5% с каждой консультации</p>
        </div>

        <div className="space-y-3">
          {bonusHistory.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[#385144] font-bold text-sm">
                    {item.services?.title || 'Консультация'}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {new Date(item.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div className="text-right">
                  {item.bonus_paid > 0 && (
                    <p className="text-green-600 font-bold text-sm">+{item.bonus_paid} ₽</p>
                  )}
                  {item.bonus_used > 0 && (
                    <p className="text-red-600 font-bold text-sm">-{item.bonus_used} ₽</p>
                  )}
                  <p className="text-gray-400 text-xs">{item.price} ₽</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {bonusHistory.length === 0 && (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500">История бонусов пуста</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_38%,#F6EFE7_72%,#EFE6DA_100%)] p-4 pb-24 text-[#2F463B]">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-48 bg-[linear-gradient(135deg,rgba(56,81,68,0.16),rgba(184,121,92,0.08),transparent)]" />
      <div className="relative mx-auto max-w-xl">
        {/* Шапка */}
        <div className="mb-5 flex items-center justify-between">
          <button
            onClick={() => setActiveTab('menu')}
            className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_12px_30px_rgba(56,81,68,0.10)] backdrop-blur transition hover:border-[#385144]/30"
          >
            <Menu className="h-5 w-5 text-[#385144]" />
          </button>

          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8A5A3F]/70">
              personal tarot space
            </p>
            <h1 className="text-xl font-black tracking-tight text-[#385144]">Tarot by Danil</h1>
          </div>
        </div>

        {activeTab === 'home' && onOpenTraining && (
          <button
            type="button"
            onClick={onOpenTraining}
            className="mb-5 w-full overflow-hidden rounded-[1.75rem] bg-[#385144] p-4 text-left text-white shadow-[0_18px_42px_rgba(56,81,68,0.18)] transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/14 text-[#F4E7C8] ring-1 ring-white/15">
                <BookOpen className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#F4E7C8]">tarot academy</p>
                <h2 className="mt-1 text-lg font-black leading-tight">Можно не только записаться, но и обучиться</h2>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-white/72">
                  Индивидуально или в группе: база, практика, домашки и бережный темп.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#F4E7C8]" />
            </div>
          </button>
        )}

        {activeTab === 'cabinet' && (
        <div className="relative mb-4 overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-br from-[#FFFCF7] via-[#F5EFE7] to-[#E8EFE7] p-5 shadow-[0_22px_55px_rgba(56,81,68,0.16)]">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#DDE9E0]/80 blur-2xl" />
          <div className="absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-[#E9D7C6]/70 blur-2xl" />
          <div className="relative">
            <div className="mb-5 flex items-start gap-4">
              <div className="relative shrink-0">
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt="Profile"
                    className="h-20 w-20 rounded-[1.5rem] border-4 border-white object-cover shadow-lg"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] border-4 border-white bg-gradient-to-br from-[#385144] via-[#5B705F] to-[#B8795C] text-2xl font-black text-white shadow-lg">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                )}
                <label className="absolute -bottom-2 -right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#385144] shadow-md">
                  <Camera className="h-4 w-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#8A5A3F]/70">
                  Личный кабинет
                </p>
                <h2 className="truncate text-2xl font-black leading-tight text-[#385144]">
                  {user.name || 'Пользователь'}
                </h2>
                <div className="mt-2 flex items-center text-sm text-[#5E675D]">
                  <MapPin className="mr-1 h-4 w-4" />
                  {user.city || 'Город не указан'}
                </div>
              </div>
            </div>

            {activeTab === 'cabinet' && (
            <button
              onClick={() => setShowPrivileges(true)}
              className="mb-3 w-full rounded-2xl border border-white/80 bg-white/75 p-4 text-left shadow-sm backdrop-blur transition hover:border-[#385144]/25"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A3F]/70">
                    Статус клиента
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-black ${statusColor}`}>
                      {currentStatus}
                    </span>
                  </div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DDE9E0] text-[#385144]">
                  <Crown className="h-5 w-5" />
                </div>
              </div>
              {hasActivePersonalTarologist && (
                <div className="mb-3 flex items-center justify-between rounded-2xl bg-[#EAF1EA] px-4 py-3 text-sm font-black text-[#385144]">
                  <span className="text-xs uppercase tracking-[0.14em] text-[#6C756C]">Активная услуга</span>
                  <span>Личное ведение</span>
                </div>
              )}
              <div className="h-2 overflow-hidden rounded-full bg-[#E5DED5]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#385144] to-[#8A9B7B]"
                  style={{ width: `${statusProgress.progress}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[#6C756C]">
                <span>{statusProgress.label}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
            )}

            {activeTab === 'cabinet' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowBonusInfo(true)}
                className="rounded-2xl border border-white/80 bg-white/75 p-4 text-left shadow-sm backdrop-blur transition hover:border-[#B8795C]/35"
              >
                <div className="mb-3 flex items-center justify-between">
                  <Sparkles className="h-5 w-5 text-[#B8795C]" />
                  <ChevronRight className="h-4 w-4 text-[#8FA092]" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C756C]">Бонусы</p>
                <p className="text-2xl font-black text-[#8A5A3F]">{user.bonus_balance || 0} ₽</p>
              </button>

              <button
                onClick={() => setShowHistory(true)}
                className="rounded-2xl border border-white/80 bg-white/75 p-4 text-left shadow-sm backdrop-blur transition hover:border-[#385144]/25"
              >
                <div className="mb-3 flex items-center justify-between">
                  <ScrollText className="h-5 w-5 text-[#385144]" />
                  <ChevronRight className="h-4 w-4 text-[#8FA092]" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C756C]">Опыт</p>
                <p className="text-2xl font-black text-[#385144]">{totalConsultations}</p>
              </button>
            </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'home' && (
        <>
        {(paymentDueConsultation || upcomingConsultation) && (
          <button
            onClick={() => setActiveTab('cabinet')}
            className="mb-4 w-full overflow-hidden rounded-[1.75rem] border border-white/80 bg-gradient-to-br from-[#385144] to-[#6A7C69] p-5 text-left text-white shadow-[0_18px_45px_rgba(56,81,68,0.20)] transition hover:-translate-y-0.5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-white/60">
                  следующий шаг
                </p>
                <h3 className="text-xl font-black leading-tight">
                  {paymentDueConsultation
                    ? getPaymentStatusText(paymentDueConsultation)
                    : upcomingConsultation?.services?.title || 'Ближайшая запись'}
                </h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#385144]">
                Открыть
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                <div className="mb-1 flex items-center text-xs text-white/70">
                  <CalendarCheck className="mr-1 h-3 w-3" />
                  Дата
                </div>
                <p className="text-sm font-black">
                  {paymentDueConsultation
                    ? getConsultationsPaymentDateText(displayPaymentDueConsultations)
                    : getConsultationDateText(upcomingConsultation)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                <div className="mb-1 flex items-center text-xs text-white/70">
                  <Clock className="mr-1 h-3 w-3" />
                  Время
                </div>
                <p className="text-sm font-black">
                  {paymentDueConsultation
                    ? getConsultationsPaymentTimeText(displayPaymentDueConsultations)
                    : getConsultationTimeText(upcomingConsultation)}
                </p>
              </div>
            </div>
          </button>
        )}

        <button
          onClick={() => setActiveTab('services')}
          className="mb-4 w-full overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/85 p-5 text-left text-[#385144] shadow-[0_16px_40px_rgba(56,81,68,0.10)] transition hover:-translate-y-0.5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">
                book your reading
              </p>
              <h3 className="text-xl font-black leading-tight">Выбрать консультацию</h3>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#385144]">
              <CalendarCheck className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-[#59645C]">
            Сначала разделы услуг, потом сами форматы. Без простыни и лишнего шума.
          </p>
          <div className="flex items-center justify-between border-t border-[#385144]/10 pt-4">
            <span className="text-sm font-bold text-[#6C756C]">{services.length || 0} форматов</span>
            <span className="inline-flex items-center rounded-full bg-[#385144] px-3 py-1 text-xs font-black text-white">
              Перейти
              <ChevronRight className="ml-1 h-4 w-4" />
            </span>
          </div>
        </button>

        <div className="mb-4 overflow-hidden rounded-[1.75rem] border border-white/80 bg-gradient-to-br from-[#FFF9F0] via-white to-[#EAF1EA] p-5 shadow-[0_16px_40px_rgba(56,81,68,0.10)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">
                daily ritual
              </p>
              <h3 className="flex items-center text-xl font-black text-[#385144]">
                <Leaf className="mr-2 h-5 w-5 text-[#B8795C]" />
                Интерактивная карта дня
              </h3>
            </div>
            <span className="rounded-full bg-[#385144]/10 px-3 py-1 text-xs font-black text-[#385144]">
              {format(new Date(), 'd MMM', { locale: ru })}
            </span>
          </div>

          {isDailyCardOpen ? (
            <div className="rounded-[1.4rem] border border-[#E6D7C9] bg-white/75 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8FA092]">
                    {dailyCard.arcana}
                  </p>
                  <p className="text-2xl font-black text-[#385144]">{dailyCard.name}</p>
                </div>
                <div className="rounded-2xl bg-[#B8795C]/10 px-3 py-2 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A5A3F]/70">
                    фокус
                  </p>
                  <p className="font-black text-[#8A5A3F]">{dailyCard.focus}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-[#59645C]">{dailyCard.message}</p>
            </div>
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-[#B8795C]/40 bg-white/60 p-4">
              <p className="mb-4 text-sm leading-relaxed text-[#59645C]">
                Это бесплатный ежедневный интерактив внутри приложения. Он не заменяет услугу “Карта дня” и не участвует в подборе консультации.
              </p>
              <button
                onClick={revealDailyCard}
                className="flex w-full items-center justify-center rounded-2xl bg-[#B8795C] py-3 font-black text-white shadow-[0_12px_28px_rgba(184,121,92,0.22)] transition hover:bg-[#9E654A]"
              >
                <Eye className="mr-2 h-5 w-5" />
                Открыть карту
              </button>
            </div>
          )}
        </div>

        </>
        )}

        {activeTab === 'services' && (
        <>
        <button
          onClick={() => {
            resetQuiz();
            setShowServiceQuiz(true);
          }}
          className="mb-4 flex w-full items-center justify-between gap-4 rounded-[1.5rem] border border-white/80 bg-[#385144] p-4 text-left text-white shadow-[0_14px_34px_rgba(56,81,68,0.18)] transition hover:-translate-y-0.5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12">
              <Sparkles className="h-5 w-5 text-[#F4E7C8]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                не знаете, что выбрать?
              </p>
              <h3 className="mt-0.5 text-lg font-black leading-tight">Подобрать формат</h3>
              <p className="mt-1 text-xs font-semibold text-white/68">3 вопроса · меньше минуты</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#385144]">
            Начать
            <ChevronRight className="ml-1 h-4 w-4" />
          </span>
        </button>

        <div>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">
              choose your reading
            </p>
            <h3 className="mt-1 flex items-center text-2xl font-black text-[#385144]">
              <CalendarCheck className="mr-2 h-6 w-6" />
              {selectedServiceGroup ? selectedServiceGroup.title : 'Разделы услуг'}
            </h3>
          </div>
          {selectedServiceGroup ? (
            <button
              onClick={() => setSelectedServiceGroupId(null)}
              className="inline-flex shrink-0 items-center rounded-2xl border border-[#385144]/15 bg-[#385144] px-4 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(56,81,68,0.22)] transition active:scale-[0.98]"
            >
              <span className="mr-2 flex h-7 w-7 items-center justify-center rounded-xl bg-white/15">
                <ArrowLeft className="h-4 w-4" />
              </span>
              К разделам
            </button>
          ) : (
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#6C756C]">
              {services.length || 0} форматов
            </span>
          )}
        </div>

        {loading ? (
          <div className="rounded-[1.75rem] border border-white/80 bg-white/80 p-8 text-center shadow-sm">
            <p className="text-[#6C756C]">Загрузка услуг...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-[1.75rem] border border-white/80 bg-white/80 p-8 text-center shadow-sm">
            <p className="text-[#6C756C]">Услуги пока не добавлены</p>
          </div>
        ) : !selectedServiceGroup ? (
          <div className="space-y-5">
            {campaignServices.length > 0 && (
              <div className="rounded-[1.5rem] border border-[#B8795C]/25 bg-[#FFF6EF] p-4 shadow-[0_12px_30px_rgba(184,121,92,0.10)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#B8795C]">
                      сейчас действует
                    </p>
                    <h4 className="text-lg font-black text-[#385144]">Акции и старые цены</h4>
                  </div>
                  <Flame className="h-5 w-5 text-[#B8795C]" />
                </div>
                <div className="grid gap-2">
                  {campaignServices.map((service) => {
                    const priceState = getServicePriceState(service, clockNow);
                    const countdown = formatCountdown(priceState.countdownTarget, clockNow);

                    return (
                      <button
                        key={service.id}
                        onClick={() => setServiceDetails(service)}
                        className="flex items-center justify-between rounded-2xl bg-white/70 p-3 text-left"
                      >
                        <span>
                          <span className="block text-sm font-black text-[#385144]">{service.title}</span>
                          <span className="mt-0.5 block text-xs font-bold text-[#8A5A3F]">
                            {priceState.isPromoActive ? 'Акция' : 'Успейте по текущей цене'}
                          </span>
                        </span>
                        {countdown && (
                          <span className="rounded-full bg-[#385144]/10 px-2.5 py-1 text-[11px] font-black text-[#385144]">
                            {countdown}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {serviceGroups.map((group, groupIndex) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedServiceGroupId(group.id)}
                  className={`overflow-hidden rounded-[1.6rem] border border-white/80 bg-gradient-to-br ${getServiceAccent(groupIndex)} p-5 text-left shadow-[0_12px_30px_rgba(56,81,68,0.09)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(56,81,68,0.13)]`}
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#8A5A3F]/65">
                        подборка
                      </p>
                      <h4 className="text-xl font-black text-[#385144]">{group.title}</h4>
                      <p className="mt-1 text-sm leading-snug text-[#6C756C]">{group.subtitle}</p>
                    </div>
                    <span className="shrink-0 rounded-2xl bg-white/75 px-3 py-2 text-center shadow-sm">
                      <span className="block text-2xl font-black leading-none text-[#385144]">{group.services.length}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8FA092]">услуг</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#385144]/10 pt-3">
                    <span className="text-xs font-bold text-[#6C756C]">
                      {group.services.slice(0, 2).map(service => service.title).join(' · ')}
                    </span>
                    <ChevronRight className="h-5 w-5 text-[#8FA092]" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <section className="space-y-3">
            <p className="px-1 text-sm leading-relaxed text-[#6C756C]">{selectedServiceGroup.subtitle}</p>

            {selectedServiceGroup.services.map((service, index) => {
              const priceState = getServicePriceState(service, clockNow);
              const countdown = formatCountdown(priceState.countdownTarget, clockNow);
              const accentIndex = index;

              return (
                <div
                  key={service.id}
                  className={`overflow-hidden rounded-[1.6rem] border ${
                    priceState.isPromoActive ? 'border-[#B8795C]/35' : 'border-white/80'
                  } bg-gradient-to-br ${getServiceAccent(accentIndex)} p-4 shadow-[0_12px_30px_rgba(56,81,68,0.09)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(56,81,68,0.13)]`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#8A5A3F]">
                          {priceState.isPromoActive ? priceState.promoTitle : getServiceBadge(service, index)}
                        </span>
                        {countdown && (
                          <span className="inline-flex rounded-full bg-[#385144]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#385144]">
                            {priceState.countdownLabel}: {countdown}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xl font-black leading-tight text-[#385144]">
                        {service.title}
                      </h4>
                    </div>
                    <div className="flex shrink-0 items-start gap-2">
                      <button
                        onClick={() => toggleFavoriteService(service.id)}
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm transition ${
                          favoriteServiceIds.includes(service.id)
                            ? 'bg-[#B8795C] text-white'
                            : 'bg-white/80 text-[#8FA092]'
                        }`}
                        aria-label="Добавить в избранное"
                      >
                        <Heart className={`h-4 w-4 ${favoriteServiceIds.includes(service.id) ? 'fill-current' : ''}`} />
                      </button>
                      <div className="rounded-2xl bg-white/80 px-3 py-2 text-right shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8FA092]">цена</p>
                        {priceState.currentPrice !== priceState.basePrice ? (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#B8795C]">акция</p>
                            <p className="text-lg font-black text-[#8A5A3F]">{priceState.currentPrice} ₽</p>
                          </div>
                        ) : (
                          <p className="text-lg font-black text-[#8A5A3F]">{priceState.currentPrice} ₽</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {service.description && (
                    <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-[#59645C]">
                      {service.short_description || service.description}
                    </p>
                  )}

                  <div className="mb-3 flex flex-wrap gap-2">
                    {getServiceBenefits(service).slice(0, 2).map((benefit) => (
                      <span
                        key={benefit}
                        className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-black text-[#385144]"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
                    <button
                      onClick={() => setServiceDetails(service)}
                      className="flex items-center justify-center rounded-2xl border border-[#385144]/10 bg-white/65 px-3 py-3 text-sm font-black text-[#385144] shadow-sm transition hover:border-[#385144]/25 hover:bg-white"
                    >
                      <Info className="mr-2 h-4 w-4" />
                      Подробнее
                    </button>
                    <button
                      onClick={() => {
                        setSelectedService(service);
                        setShowBooking(true);
                      }}
                      className="flex items-center justify-between rounded-2xl bg-[#385144] px-4 py-3 font-black text-white shadow-[0_12px_28px_rgba(56,81,68,0.18)] transition hover:bg-[#2d4238]"
                    >
                      <span className="inline-flex items-center">
                        <CalendarCheck className="mr-2 h-4 w-4" />
                        Записаться
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-white/75">
                        {service.duration_minutes ? `${service.duration_minutes} мин` : 'Время'}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}
        </div>
        </>
        )}

        {activeTab === 'cabinet' && (
        <>
          {miniPaymentStatus && (
            <div
              className={`mb-4 overflow-hidden rounded-[1.75rem] border p-5 shadow-[0_18px_44px_rgba(56,81,68,0.12)] ${
                miniPaymentStatus.type === 'success'
                  ? 'border-[#BFD7C2] bg-[#ECF6ED] text-[#385144]'
                  : miniPaymentStatus.type === 'error'
                    ? 'border-[#D9B8A4] bg-[#FFF4EA] text-[#8A5A3F]'
                    : 'border-white/80 bg-white/85 text-[#385144]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-[#B8795C]">
                    t-bank status
                  </p>
                  <h3 className="text-xl font-black leading-tight">{miniPaymentStatus.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed opacity-70">{miniPaymentStatus.message}</p>
                </div>
                <div className="rounded-2xl bg-white/70 px-3 py-2 text-right shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-55">сумма</p>
                  <p className="text-lg font-black">
                    {miniPaymentStatus.amount ? `${miniPaymentStatus.amount.toLocaleString()} ₽` : '—'}
                  </p>
                </div>
              </div>
              {miniPaymentStatus.orderId && (
                <p className="mt-3 break-words rounded-2xl bg-white/55 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] opacity-60">
                  заказ {miniPaymentStatus.orderId}
                </p>
              )}
            </div>
          )}

          {paymentDueConsultation && (
            <div className="mb-4 overflow-hidden rounded-[1.75rem] border border-[#D9B8A4] bg-gradient-to-br from-[#FFF4EA] via-white to-[#F8EDE7] p-5 shadow-[0_18px_44px_rgba(138,90,63,0.14)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-[#B8795C]">
                    payment focus
                  </p>
                  <h3 className="text-xl font-black leading-tight text-[#385144]">
                    {getPaymentStatusText(paymentDueConsultation)}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-[#6C756C]">
                    {getConsultationsPaymentTitle(displayPaymentDueConsultations)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/80 px-3 py-2 text-right shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8FA092]">к оплате</p>
                  <p className="text-xl font-black text-[#8A5A3F]">
                    {paymentDueTotal.toLocaleString()} ₽
                  </p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/65 p-3">
                  <div className="mb-1 flex items-center text-xs font-bold text-[#8A5A3F]">
                    <CalendarCheck className="mr-1 h-3 w-3" />
                    Дата
                  </div>
                  <p className="text-sm font-black text-[#385144]">
                    {getConsultationsPaymentDateText(displayPaymentDueConsultations)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/65 p-3">
                  <div className="mb-1 flex items-center text-xs font-bold text-[#8A5A3F]">
                    <Clock className="mr-1 h-3 w-3" />
                    Время
                  </div>
                  <p className="text-sm font-black text-[#385144]">
                    {getConsultationsPaymentTimeText(displayPaymentDueConsultations)}
                  </p>
                </div>
              </div>

              {paymentDueIsMarkedPaid ? (
                <div className="rounded-2xl bg-[#385144]/10 px-4 py-3 text-sm font-black text-[#385144]">
                  Я уже вижу отметку об оплате. После проверки бонусы и консультация зачтутся автоматически.
                </div>
              ) : (
                <button
                  onClick={() => openPaymentLink(displayPaymentDueConsultations)}
                  disabled={paymentBusy}
                  className="w-full rounded-2xl bg-[#385144] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {paymentBusy ? 'Создаю платёж' : 'Оплатить через Т-Банк'}
                </button>
              )}
            </div>
          )}

          {upcomingConsultation && (
            <button
              onClick={() => setShowHistory(true)}
              className="mb-4 w-full overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/85 p-5 text-left shadow-[0_16px_40px_rgba(56,81,68,0.10)] transition hover:-translate-y-0.5 hover:border-[#385144]/25"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#8A5A3F]/70">
                    ближайшая запись
                  </p>
                  <h3 className="text-xl font-black leading-tight text-[#385144]">
                    {upcomingConsultation.services?.title || 'Консультация'}
                  </h3>
                </div>
                <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-black ${
                  consultationStatusColors[upcomingConsultation.status] || 'bg-[#EAF1EA] text-[#385144]'
                }`}>
                  {getConsultationStatusText(upcomingConsultation)}
                </span>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#F8F3EC] p-3">
                  <div className="mb-1 flex items-center text-xs font-bold text-[#8A5A3F]">
                    <CalendarCheck className="mr-1 h-3 w-3" />
                    Дата
                  </div>
                  <p className="text-sm font-black text-[#385144]">
                    {getConsultationDateText(upcomingConsultation)}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#F8F3EC] p-3">
                  <div className="mb-1 flex items-center text-xs font-bold text-[#8A5A3F]">
                    <Clock className="mr-1 h-3 w-3" />
                    Время
                  </div>
                  <p className="text-sm font-black text-[#385144]">
                    {getConsultationTimeText(upcomingConsultation)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#385144] px-4 py-3 text-sm font-black text-white">
                <span>Посмотреть детали</span>
                <ChevronRight className="h-4 w-4" />
              </div>
              {upcomingConsultation.payment_status !== 'paid' && (
                <div
                  onClick={(event) => {
                    event.stopPropagation();
                    openPaymentLink(upcomingConsultation);
                  }}
                  className="mt-3 flex items-center justify-center rounded-2xl bg-[#B8795C] px-4 py-3 text-sm font-black text-white"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {paymentBusy ? 'Создаю платёж' : `Оплатить ${upcomingConsultation.payment_amount || upcomingConsultation.price || 0} ₽`}
                </div>
              )}
            </button>
          )}

          <div className="mb-4 rounded-[1.75rem] border border-white/80 bg-white/85 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.10)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8A5A3F]/70">
                  ваши форматы
                </p>
                <h3 className="mt-1 text-xl font-black text-[#385144]">Избранные услуги</h3>
              </div>
              <Heart className="h-5 w-5 text-[#B8795C]" />
            </div>

            {favoriteServices.length === 0 ? (
              <div className="rounded-[1.3rem] bg-[#F8F3EC] p-4">
                <p className="text-sm leading-relaxed text-[#59645C]">
                  Отмечайте услуги сердечком — здесь появится быстрый доступ к любимым форматам.
                </p>
                <button
                  onClick={() => setActiveTab('services')}
                  className="mt-3 rounded-2xl bg-[#385144] px-4 py-3 text-sm font-black text-white"
                >
                  Перейти к услугам
                </button>
              </div>
            ) : (
              <div className="grid gap-2">
                {favoriteServices.slice(0, 3).map((service) => (
                  <button
                    key={service.id}
                    onClick={() => setServiceDetails(service)}
                    className="flex items-center justify-between rounded-2xl bg-[#F8F3EC] p-3 text-left"
                  >
                    <span>
                      <span className="block text-sm font-black text-[#385144]">{service.title}</span>
                      <span className="mt-0.5 block text-xs font-bold text-[#8A5A3F]">
                        {getServicePriceState(service, clockNow).currentPrice} ₽
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-[#8FA092]" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-7 grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowHistory(true)}
              className="rounded-[1.5rem] border border-white/80 bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(56,81,68,0.08)] transition hover:-translate-y-0.5 hover:border-[#385144]/25"
            >
              <ScrollText className="mb-4 h-6 w-6 text-[#385144]" />
              <p className="font-black text-[#385144]">История</p>
              <p className="mt-1 text-xs leading-snug text-[#6C756C]">Записи, статусы и рекомендации</p>
            </button>

            <button
              onClick={() => setShowReferral(true)}
              className="rounded-[1.5rem] border border-white/80 bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(56,81,68,0.08)] transition hover:-translate-y-0.5 hover:border-[#B8795C]/35"
            >
              <Gift className="mb-4 h-6 w-6 text-[#B8795C]" />
              <p className="font-black text-[#385144]">Пригласить</p>
              <p className="mt-1 text-xs leading-snug text-[#6C756C]">Бонусы за тёплые рекомендации</p>
            </button>
          </div>
        </>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-3">
            {onOpenTraining && (
              <button
                onClick={onOpenTraining}
                className="flex w-full items-center justify-between rounded-[1.6rem] border border-[#385144]/10 bg-[#385144] p-4 text-left text-white shadow-[0_16px_36px_rgba(56,81,68,0.22)]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
                    <BookOpen className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
                      tarot academy
                    </span>
                    <span className="block font-black">Перейти в Академию</span>
                    <span className="mt-1 block text-xs text-white/68">Обучение, группы и кабинет ученика</span>
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 text-white/70" />
              </button>
            )}
            <button
              onClick={() => setShowInfoMenu(true)}
              className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/80 bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(56,81,68,0.08)]"
            >
              <span>
                <span className="block font-black text-[#385144]">Информация</span>
                <span className="mt-1 block text-xs text-[#6C756C]">Правила, контакты и полезные детали</span>
              </span>
              <ChevronRight className="h-5 w-5 text-[#8FA092]" />
            </button>
            <button
              onClick={() => setShowReferral(true)}
              className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/80 bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(56,81,68,0.08)]"
            >
              <span>
                <span className="block font-black text-[#385144]">Пригласить друга</span>
                <span className="mt-1 block text-xs text-[#6C756C]">Реферальная ссылка и бонусы</span>
              </span>
              <ChevronRight className="h-5 w-5 text-[#8FA092]" />
            </button>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-4 z-30 px-4">
        <div className={`mx-auto grid max-w-xl ${onOpenTraining ? 'grid-cols-5' : 'grid-cols-4'} gap-2 rounded-[1.5rem] border border-white/75 bg-white/85 p-2 shadow-[0_18px_45px_rgba(56,81,68,0.18)] backdrop-blur`}>
          {[
            { id: 'home' as DashboardTab, label: 'Главная', icon: Home },
            { id: 'services' as DashboardTab, label: 'Услуги', icon: CalendarCheck },
            { id: 'cabinet' as DashboardTab, label: 'Кабинет', icon: UserCircle },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center rounded-[1.1rem] px-2 py-2 text-[11px] font-black transition ${
                  isActive
                    ? 'bg-[#385144] text-white shadow-[0_10px_22px_rgba(56,81,68,0.18)]'
                    : 'text-[#6C756C] hover:bg-[#F3EEE7]'
                }`}
              >
                <Icon className="mb-1 h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          {onOpenTraining && (
            <button
              onClick={onOpenTraining}
              className="flex flex-col items-center justify-center rounded-[1.1rem] px-2 py-2 text-[11px] font-black text-[#6C756C] transition hover:bg-[#F3EEE7]"
            >
              <BookOpen className="mb-1 h-4 w-4" />
              Академия
            </button>
          )}
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex flex-col items-center justify-center rounded-[1.1rem] px-2 py-2 text-[11px] font-black transition ${
              activeTab === 'menu'
                ? 'bg-[#385144] text-white shadow-[0_10px_22px_rgba(56,81,68,0.18)]'
                : 'text-[#6C756C] hover:bg-[#F3EEE7]'
            }`}
          >
            <Menu className="mb-1 h-4 w-4" />
            Меню
          </button>
        </div>
      </div>

      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-end bg-[#1F2E27]/35 p-3 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/70 bg-[#FFFCF7] shadow-[0_24px_70px_rgba(31,46,39,0.28)]">
            <div className="bg-gradient-to-br from-[#385144] to-[#6A7C69] p-5 text-white">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-white/60">
                welcome ritual
              </p>
              <h3 className="text-2xl font-black leading-tight">Как здесь всё устроено</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                Три короткие детали, чтобы запись ощущалась спокойно и понятно.
              </p>
            </div>
            <div className="space-y-3 p-4">
              {ONBOARDING_CARDS.map((card, index) => (
                <div key={card.title} className="rounded-[1.4rem] bg-[#F8F3EC] p-4">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#385144] text-xs font-black text-white">
                      0{index + 1}
                    </span>
                    <p className="font-black text-[#385144]">{card.title}</p>
                  </div>
                  <p className="text-sm leading-relaxed text-[#59645C]">{card.text}</p>
                </div>
              ))}
              <button
                onClick={closeOnboarding}
                className="w-full rounded-2xl bg-[#385144] py-4 font-black text-white shadow-[0_14px_30px_rgba(56,81,68,0.22)]"
              >
                Понятно, к услугам
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальные окна */}
      {serviceDetails && (
        <div className="fixed inset-0 z-50 flex items-end bg-[#1F2E27]/35 p-3 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/70 bg-[#FFFCF7] shadow-[0_24px_70px_rgba(31,46,39,0.28)]">
            <div className="bg-gradient-to-br from-[#385144] to-[#6A7C69] p-5 text-white">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-white/60">
                    формат консультации
                  </p>
                  <h3 className="text-2xl font-black leading-tight">{serviceDetails.title}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleFavoriteService(serviceDetails.id)}
                    className={`rounded-2xl px-3 py-2 text-white ${
                      favoriteServiceIds.includes(serviceDetails.id) ? 'bg-[#B8795C]' : 'bg-white/12'
                    }`}
                    aria-label="Добавить в избранное"
                  >
                    <Heart className={`h-5 w-5 ${favoriteServiceIds.includes(serviceDetails.id) ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={() => setServiceDetails(null)}
                    className="rounded-2xl bg-white/12 px-3 py-2 text-lg font-black text-white"
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold">
                  {serviceDetails.duration_minutes ? `${serviceDetails.duration_minutes} минут` : 'Индивидуально'}
                </span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold">
                  {getServicePriceState(serviceDetails, clockNow).currentPrice} ₽
                </span>
              </div>
            </div>
            <div className="space-y-4 p-4">
              {serviceDetails.description && (
                <p className="rounded-[1.35rem] bg-[#F8F3EC] p-4 text-sm leading-relaxed text-[#59645C]">
                  {serviceDetails.short_description || serviceDetails.description}
                </p>
              )}
              <div className="rounded-[1.35rem] border border-[#385144]/10 bg-white/80 p-4">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#8A5A3F]/70">
                  что даст формат
                </p>
                <p className="text-sm leading-relaxed text-[#59645C]">{getServiceOutcome(serviceDetails)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {getServiceBenefits(serviceDetails).map((benefit) => (
                    <span key={benefit} className="rounded-full bg-[#EAF1EA] px-3 py-1 text-xs font-black text-[#385144]">
                      {benefit}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedService(serviceDetails);
                  setServiceDetails(null);
                  setShowBooking(true);
                }}
                className="w-full rounded-2xl bg-[#385144] py-4 font-black text-white shadow-[0_14px_30px_rgba(56,81,68,0.22)]"
              >
                Записаться на этот формат
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && paymentDueConsultation && (
        <div className="fixed inset-0 z-50 flex items-end bg-[#1F2E27]/45 p-3 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#F2D2BF] bg-[#FFF1E8] shadow-[0_24px_70px_rgba(31,46,39,0.30)]">
            <div className="bg-gradient-to-br from-[#8A5A3F] to-[#B8795C] p-5 text-white">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-white/62">
                    payment request
                  </p>
                  <h3 className="text-2xl font-black leading-tight">Оплата консультации</h3>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="rounded-2xl bg-white/14 px-3 py-2 text-lg font-black text-white"
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <p className="text-sm font-semibold leading-relaxed text-white/78">
                Консультация завершена. Чтобы я подтвердил оплату и начислил бонусы, пожалуйста, оплатите её через приложение.
              </p>
            </div>

            <div className="space-y-3 p-4">
              <div className="rounded-[1.4rem] bg-white/75 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8A5A3F]/70">Тема обращения</p>
                <p className="mt-1 text-xl font-black text-[#385144]">
                  {getConsultationsPaymentTitle(displayPaymentDueConsultations)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[1.4rem] bg-white/75 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8A5A3F]/70">Дата</p>
                  <p className="mt-1 font-black text-[#385144]">{getConsultationsPaymentDateText(displayPaymentDueConsultations)}</p>
                </div>
                <div className="rounded-[1.4rem] bg-white/75 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8A5A3F]/70">Время</p>
                  <p className="mt-1 font-black text-[#385144]">{getConsultationsPaymentTimeText(displayPaymentDueConsultations)}</p>
                </div>
              </div>

              <div className="rounded-[1.4rem] bg-[#385144] p-4 text-white">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/58">Итоговая стоимость</p>
                <p className="mt-1 text-3xl font-black">
                  {paymentDueTotal.toLocaleString()} ₽
                </p>
              </div>

              {primaryPaymentMethod?.instructions && (
                <p className="rounded-[1.4rem] bg-white/60 p-4 text-sm font-semibold leading-relaxed text-[#6C756C]">
                  {primaryPaymentMethod.instructions}
                </p>
              )}

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => openPaymentLink(displayPaymentDueConsultations)}
                  disabled={paymentBusy}
                  className="flex w-full items-center justify-center rounded-2xl bg-[#385144] py-4 font-black text-white shadow-[0_14px_30px_rgba(56,81,68,0.22)] disabled:opacity-60"
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  {paymentBusy ? 'Создаю платёж' : 'Оплатить через Т-Банк'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrivileges && (
        <PrivilegeCards
          currentStatus={currentStatus}
          totalConsultations={totalConsultations}
          onClose={() => setShowPrivileges(false)}
        />
      )}

      {showInfoMenu && (
        <InfoMenu onClose={() => setShowInfoMenu(false)} />
      )}

      {showReferral && (
        <ReferralProgram
          user={user}
          onClose={() => setShowReferral(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
