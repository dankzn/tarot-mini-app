import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BookingForm } from './BookingForm';
import { ConsultationHistory } from './ConsultationHistory';
import { PrivilegeCards } from './PrivilegeCards';
import { InfoMenu } from './InfoMenu';
import { ReferralProgram } from './ReferralProgram';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Crown, 
  Sparkles, 
  ScrollText, 
  Gift, 
  CalendarCheck,
  MapPin,
  Clock,
  ChevronRight,
  Menu,
  Camera,
  Eye,
  Leaf
} from 'lucide-react';

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration_minutes?: number;
}

interface DashboardProps {
  user: any;
}

interface DailyCard {
  name: string;
  arcana: string;
  focus: string;
  message: string;
}

const consultationStatusLabels: Record<string, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  in_progress: 'В процессе',
};

const consultationStatusColors: Record<string, string> = {
  pending: 'bg-[#F4E7C8] text-[#7A5A21]',
  confirmed: 'bg-[#DDE9E0] text-[#385144]',
  in_progress: 'bg-[#E7D8C9] text-[#8A5A3F]',
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
  const title = service.title.toLowerCase();

  if (title.includes('карта') || title.includes('new')) return 'Новый формат';
  if (index === 0) return 'Мягкий вход';
  if (service.duration_minutes && service.duration_minutes >= 90) return 'Глубокий разбор';
  if (service.price >= 3000) return 'Для сложного запроса';

  return 'Индивидуально';
};

const getServiceAccent = (index: number) => {
  const accents = [
    'from-[#F7F0E7] via-white to-[#EEF3EE]',
    'from-[#EEF3EE] via-white to-[#F3E8DA]',
    'from-[#F7EFE8] via-white to-[#E8EFE7]',
  ];

  return accents[index % accents.length];
};

const getDailyCardDateKey = () => new Date().toISOString().slice(0, 10);

const getDailyCard = (seed: string): DailyCard => {
  const dateKey = getDailyCardDateKey();
  const hash = `${seed}-${dateKey}`.split('').reduce((acc, char) => (
    (acc * 31 + char.charCodeAt(0)) % 9973
  ), 7);

  return DAILY_CARDS[hash % DAILY_CARDS.length];
};

export const Dashboard = ({ user }: DashboardProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showBonusInfo, setShowBonusInfo] = useState(false);
  const [showPrivileges, setShowPrivileges] = useState(false);
  const [showInfoMenu, setShowInfoMenu] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [bonusHistory, setBonusHistory] = useState<any[]>([]);
  const [totalConsultations, setTotalConsultations] = useState(0);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [upcomingConsultation, setUpcomingConsultation] = useState<any>(null);
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

  useEffect(() => {
    loadServices();
    loadBonusHistory();
    loadTotalConsultations();
    loadUpcomingConsultation();
    loadProfilePhoto();
  }, []);

  const loadServices = async () => {
    try {
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
    const { count } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed');

    setTotalConsultations(count || 0);
  };

  const loadUpcomingConsultation = async () => {
    const { data, error } = await supabase
      .from('consultations')
      .select('id, scheduled_at, status, price, bonus_used, services(title, duration_minutes)')
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed', 'in_progress'])
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
    'Личное ведение': 'bg-[#DDE9E0] text-[#385144]',
  };

  const currentStatus = user.status || 'Первое знакомство';
  const statusColor = statusColors[currentStatus] || statusColors['Первое знакомство'];
  const statusProgress = getStatusProgress(currentStatus, totalConsultations);

  const revealDailyCard = () => {
    try {
      window.localStorage.setItem(dailyCardStorageKey, 'open');
    } catch {
      // localStorage может быть недоступен внутри некоторых WebView
    }

    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    setIsDailyCardOpen(true);
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
    return <ConsultationHistory user={user} onBack={() => setShowHistory(false)} />;
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
        {/* Шапка с бургер-меню */}
        <div className="mb-5 flex items-center justify-between">
          <button
            onClick={() => setShowInfoMenu(true)}
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

        {/* Карточка пользователя */}
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

            <button
              onClick={() => setShowPrivileges(true)}
              className="mb-3 w-full rounded-2xl border border-white/80 bg-white/75 p-4 text-left shadow-sm backdrop-blur transition hover:border-[#385144]/25"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A3F]/70">
                    Статус клиента
                  </p>
                  <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-black ${statusColor}`}>
                    {currentStatus}
                  </span>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DDE9E0] text-[#385144]">
                  <Crown className="h-5 w-5" />
                </div>
              </div>
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
          </div>
        </div>

        {upcomingConsultation && (
          <button
            onClick={() => setShowHistory(true)}
            className="mb-4 w-full overflow-hidden rounded-[1.75rem] bg-[#385144] p-5 text-left text-white shadow-[0_18px_45px_rgba(56,81,68,0.22)] transition hover:bg-[#2d4238]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#DDE9E0]/80">
                  Активная запись
                </p>
                <h3 className="text-xl font-black leading-tight">
                  {upcomingConsultation.services?.title || 'Консультация'}
                </h3>
              </div>
              <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-black ${
                consultationStatusColors[upcomingConsultation.status] || 'bg-white/15 text-white'
              }`}>
                {consultationStatusLabels[upcomingConsultation.status] || upcomingConsultation.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                <div className="mb-1 flex items-center text-xs text-white/70">
                  <CalendarCheck className="mr-1 h-3 w-3" />
                  Дата
                </div>
                <p className="text-sm font-black">
                  {format(new Date(upcomingConsultation.scheduled_at), 'd MMMM', { locale: ru })}
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                <div className="mb-1 flex items-center text-xs text-white/70">
                  <Clock className="mr-1 h-3 w-3" />
                  Время
                </div>
                <p className="text-sm font-black">
                  {format(new Date(upcomingConsultation.scheduled_at), 'HH:mm')}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-4">
              <span className="text-sm text-white/72">
                {upcomingConsultation.bonus_used > 0
                  ? `Бонусами списано: ${upcomingConsultation.bonus_used} ₽`
                  : 'Без списания бонусов'}
              </span>
              <span className="text-lg font-black">{upcomingConsultation.price} ₽</span>
            </div>
          </button>
        )}

        <div className="mb-4 overflow-hidden rounded-[1.75rem] border border-white/80 bg-gradient-to-br from-[#FFF9F0] via-white to-[#EAF1EA] p-5 shadow-[0_16px_40px_rgba(56,81,68,0.10)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">
                daily ritual
              </p>
              <h3 className="flex items-center text-xl font-black text-[#385144]">
                <Leaf className="mr-2 h-5 w-5 text-[#B8795C]" />
                Карта дня
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
                Откройте мягкий ориентир на день. Карта закрепится за вами до завтра.
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

        {/* Кнопки навигации */}
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

        {/* Список услуг */}
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">
                choose your reading
              </p>
              <h3 className="mt-1 flex items-center text-2xl font-black text-[#385144]">
                <CalendarCheck className="mr-2 h-6 w-6" />
                Услуги
              </h3>
            </div>
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#6C756C]">
              {services.length || 0} форматов
            </span>
          </div>

          {loading ? (
            <div className="rounded-[1.75rem] border border-white/80 bg-white/80 p-8 text-center shadow-sm">
              <p className="text-[#6C756C]">Загрузка услуг...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="rounded-[1.75rem] border border-white/80 bg-white/80 p-8 text-center shadow-sm">
              <p className="text-[#6C756C]">Услуги пока не добавлены</p>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((service, index) => (
                <div
                  key={service.id}
                  className={`overflow-hidden rounded-[1.8rem] border border-white/80 bg-gradient-to-br ${getServiceAccent(index)} p-5 shadow-[0_16px_40px_rgba(56,81,68,0.10)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(56,81,68,0.15)]`}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="mb-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#8A5A3F]">
                        {getServiceBadge(service, index)}
                      </span>
                      <h4 className="text-2xl font-black leading-tight text-[#385144]">
                        {service.title}
                      </h4>
                    </div>
                    <div className="shrink-0 rounded-2xl bg-white/80 px-4 py-3 text-right shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8FA092]">стоимость</p>
                      <p className="text-xl font-black text-[#8A5A3F]">{service.price} ₽</p>
                    </div>
                  </div>

                  {service.description && (
                    <p className="mb-4 text-[15px] leading-relaxed text-[#59645C]">
                      {service.description}
                    </p>
                  )}

                  <div className="mb-4 flex flex-wrap gap-2">
                    {service.duration_minutes && (
                      <span className="inline-flex items-center rounded-full bg-[#385144]/10 px-3 py-2 text-xs font-bold text-[#385144]">
                        <Clock className="mr-1.5 h-3.5 w-3.5" />
                        {service.duration_minutes} минут
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-[#B8795C]/10 px-3 py-2 text-xs font-bold text-[#8A5A3F]">
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Личный разбор
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedService(service);
                      setShowBooking(true);
                    }}
                    className="flex w-full items-center justify-center rounded-2xl bg-[#385144] py-4 font-black text-white shadow-[0_12px_28px_rgba(56,81,68,0.20)] transition hover:bg-[#2d4238]"
                  >
                    <CalendarCheck className="mr-2 h-5 w-5" />
                    Записаться на консультацию
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Модальные окна */}
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
