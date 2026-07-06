import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Clock,
  CreditCard,
  DollarSign,
  GraduationCap,
  LayoutGrid,
  LogOut,
  Megaphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ensureAdminSession } from '../lib/adminAuth';
import { trainingPaymentLabels, trainingStatusLabels } from '../lib/training';

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  in_progress: 'В процессе',
  awaiting_payment: 'Ждёт оплату',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

const schedulingLabels: Record<string, string> = {
  needs_admin_time: 'Нужно предложить время',
  awaiting_client_confirmation: 'Ждём ответ клиента',
  client_countered: 'Клиент предложил время',
};

const getConsultationLabel = (consultation: any) => (
  schedulingLabels[consultation.scheduling_status] ||
  statusLabels[consultation.status] ||
  consultation.status ||
  'Запись'
);

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Дата не назначена';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата не назначена';

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getEventTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AdminWebDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalConsultations: 0,
    totalRevenue: 0,
    todayConsultations: 0,
    awaitingPayment: 0,
    markedPaid: 0,
    needsAdminTime: 0,
    awaitingClientConfirmation: 0,
    clientCountered: 0,
    activeCampaigns: 0,
    moneyInWork: 0,
    trainingPending: 0,
    trainingWaitlist: 0,
  });
  const [consultations, setConsultations] = useState<any[]>([]);
  const [trainingEnrollments, setTrainingEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadData();

    const refreshOnFocus = () => loadData();
    const intervalId = window.setInterval(loadData, 30000);
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, []);

  const checkAuth = async () => {
    const { ok } = await ensureAdminSession();
    if (!ok) navigate('/admin-web');
  };

  const loadData = async () => {
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, created_at');

      const { data: consultationsData, error: consultationsError } = await supabase
        .from('consultations')
        .select('id, user_id, status, scheduling_status, payment_status, price, payment_amount, scheduled_at, requested_date, created_at')
        .order('created_at', { ascending: false });

      if (consultationsError) throw consultationsError;

      const { data: servicesData } = await supabase
        .from('services')
        .select('id, promo_starts_at, promo_ends_at, price_increase_at');

      const usersById = new Map((usersData || []).map((user: any) => [user.id, user]));
      const enrichedConsultations = (consultationsData || []).map((consultation: any) => ({
        ...consultation,
        users: usersById.get(consultation.user_id) || null,
      }));

      let enrollmentsData: any[] = [];
      const trainingRequest = await supabase
        .from('training_enrollments')
        .select('*, users(name), training_programs(title), training_groups(title)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!trainingRequest.error) {
        enrollmentsData = trainingRequest.data || [];
      }

      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const completedConsultations = consultationsData?.filter(c => c.status === 'completed') || [];
      const awaitingPaymentConsultations = consultationsData?.filter(c => c.status === 'awaiting_payment') || [];
      const markedPaid = awaitingPaymentConsultations.filter(c => c.payment_status === 'marked_paid').length;
      const moneyInWork = awaitingPaymentConsultations.reduce((sum, c) => sum + (c.payment_amount || c.price || 0), 0);
      const activeCampaigns = servicesData?.filter(service => {
        const promoActive = service.promo_starts_at && service.promo_ends_at
          && new Date(service.promo_starts_at) <= now
          && new Date(service.promo_ends_at) >= now;
        const priceChangePlanned = service.price_increase_at && new Date(service.price_increase_at) > now;
        return promoActive || priceChangePlanned;
      }).length || 0;

      setStats({
        totalUsers: usersData?.length || 0,
        totalConsultations: consultationsData?.length || 0,
        totalRevenue: completedConsultations.reduce((sum, c) => sum + (c.payment_amount || c.price || 0), 0) || 0,
        todayConsultations: consultationsData?.filter(c => {
          if (!c.scheduled_at) return false;
          const scheduledAt = new Date(c.scheduled_at);
          return scheduledAt >= startOfDay && scheduledAt <= endOfDay;
        }).length || 0,
        awaitingPayment: awaitingPaymentConsultations.length,
        markedPaid,
        needsAdminTime: consultationsData?.filter(c => c.scheduling_status === 'needs_admin_time').length || 0,
        awaitingClientConfirmation: consultationsData?.filter(c => c.scheduling_status === 'awaiting_client_confirmation').length || 0,
        clientCountered: consultationsData?.filter(c => c.scheduling_status === 'client_countered').length || 0,
        activeCampaigns,
        moneyInWork,
        trainingPending: enrollmentsData.filter(enrollment => ['pending', 'details', 'contract'].includes(enrollment.status)).length,
        trainingWaitlist: enrollmentsData.filter(enrollment => enrollment.status === 'waitlist').length,
      });

      setConsultations(enrichedConsultations);
      setTrainingEnrollments(enrollmentsData);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('admin_session');
    navigate('/admin-web');
  };

  const actionItems = useMemo(() => [
    {
      title: 'Предложить время',
      value: stats.needsAdminTime,
      hint: 'приоритетные записи без слота',
      path: '/admin-web/consultations',
      tone: 'bg-[#FFF7E8] text-[#8A5A3F]',
      icon: Clock,
    },
    {
      title: 'Ответ клиента',
      value: stats.awaitingClientConfirmation + stats.clientCountered,
      hint: 'подтвердить или разобрать встречное время',
      path: '/admin-web/consultations',
      tone: 'bg-[#EAF1EA] text-[#385144]',
      icon: CalendarCheck,
    },
    {
      title: 'Проверить оплату',
      value: stats.markedPaid,
      hint: 'клиент отметил оплату',
      path: '/admin-web/consultations',
      tone: 'bg-[#385144] text-white',
      icon: CreditCard,
    },
    {
      title: 'Заявки академии',
      value: stats.trainingPending + stats.trainingWaitlist,
      hint: 'новые ученики и лист ожидания',
      path: '/admin-web/training',
      tone: 'bg-[#F8EDE7] text-[#8A5A3F]',
      icon: GraduationCap,
    },
  ], [stats]);

  const activityItems = useMemo(() => {
    const consultationEvents = consultations.slice(0, 12).map((consultation) => {
      const isPayment = consultation.status === 'awaiting_payment' || consultation.payment_status === 'marked_paid';
      const isManual = ['needs_admin_time', 'awaiting_client_confirmation', 'client_countered'].includes(consultation.scheduling_status);

      return {
        id: `consultation-${consultation.id}`,
        title: isPayment ? 'Оплата по консультации' : isManual ? getConsultationLabel(consultation) : 'Запись на консультацию',
        text: `${consultation.users?.name || 'Клиент'} · ${formatDateTime(consultation.scheduled_at || consultation.created_at)}`,
        meta: `${(consultation.payment_amount || consultation.price || 0).toLocaleString('ru-RU')} ₽`,
        time: getEventTime(consultation.created_at),
        path: '/admin-web/consultations',
        icon: isPayment ? CreditCard : CalendarCheck,
        createdAt: consultation.created_at,
      };
    });

    const trainingEvents = trainingEnrollments.slice(0, 10).map((enrollment) => ({
      id: `training-${enrollment.id}`,
      title: trainingStatusLabels[enrollment.status] || 'Заявка на обучение',
      text: `${enrollment.users?.name || 'Клиент'} · ${enrollment.training_programs?.title || 'Обучение Таро'}`,
      meta: trainingPaymentLabels[enrollment.payment_status] || '',
      time: getEventTime(enrollment.created_at),
      path: '/admin-web/training',
      icon: BookOpen,
      createdAt: enrollment.created_at,
    }));

    return [...consultationEvents, ...trainingEvents]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 10);
  }, [consultations, trainingEnrollments]);

  const navigationCards = [
    { title: 'Записи', text: 'консультации, время, оплаты', path: '/admin-web/consultations', icon: CalendarCheck },
    { title: 'Обучение', text: 'группы, ученики, лист ожидания', path: '/admin-web/training', icon: GraduationCap },
    { title: 'Услуги', text: 'цены, акции, витрина', path: '/admin-web/services', icon: Sparkles },
    { title: 'Окна', text: 'слоты для записи', path: '/admin-web/slots', icon: CalendarDays },
    { title: 'Рассылки', text: 'сообщения клиентам', path: '/admin-web/mailings', icon: Megaphone },
    { title: 'Клиенты', text: 'карточки и база', path: '/admin-web/clients', icon: Users },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5F2]">
        <div className="rounded-[2rem] bg-white/80 px-6 py-5 font-black text-[#385144] shadow-sm">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_42%,#EFE6DA_100%)] text-[#2F463B]">
      <div className="border-b border-white/70 bg-white/75 shadow-[0_12px_35px_rgba(56,81,68,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">tarot operations</p>
            <h1 className="text-3xl font-black text-[#385144]">Пульт администратора</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center rounded-2xl border border-[#385144]/10 bg-white/75 px-4 py-3 font-bold text-[#5E675D] transition hover:border-red-200 hover:text-red-600"
          >
            <LogOut className="mr-2 h-5 w-5" />
            Выйти
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="mb-6 overflow-hidden rounded-[2rem] bg-[#385144] p-6 text-white shadow-[0_22px_55px_rgba(56,81,68,0.20)]">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/55">today room</p>
              <h2 className="mt-1 text-3xl font-black">Что требует внимания</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
                Главная теперь показывает только живые события и действия. Всё остальное — в отдельных разделах.
              </p>
            </div>
            <button
              onClick={loadData}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#385144]"
            >
              Обновить
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {actionItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  onClick={() => navigate(item.path)}
                  className={`rounded-[1.35rem] p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${item.tone}`}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <Icon className="h-5 w-5 opacity-80" />
                    <span className="rounded-full bg-white/24 px-3 py-1 text-xs font-black">{item.value}</span>
                  </div>
                  <p className="text-lg font-black">{item.title}</p>
                  <p className="mt-1 text-xs font-semibold opacity-75">{item.hint}</p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'Клиенты', value: stats.totalUsers, icon: Users },
            { label: 'Записи', value: stats.totalConsultations, icon: CalendarCheck },
            { label: 'Сегодня', value: stats.todayConsultations, icon: CalendarDays },
            { label: 'Акции', value: stats.activeCampaigns, icon: Sparkles },
            { label: 'В работе', value: `${stats.moneyInWork.toLocaleString('ru-RU')} ₽`, icon: DollarSign },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-[1.4rem] border border-white/80 bg-white/82 p-4 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
                <Icon className="mb-3 h-5 w-5 text-[#B8795C]" />
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9AA39B]">{item.label}</p>
                <p className="mt-2 text-2xl font-black text-[#385144]">{item.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-[1.9rem] border border-white/80 bg-white/86 p-6 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">live notifications</p>
                <h3 className="text-2xl font-black text-[#385144]">Лента действий</h3>
              </div>
              <Bell className="h-6 w-6 text-[#B8795C]" />
            </div>

            {activityItems.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-[#D8CFC4] bg-[#F8F5F2] p-6 text-sm font-bold text-[#6C756C]">
                Новых действий пока нет. Здесь будут появляться записи, оплаты, ответы клиентов и заявки Академии.
              </div>
            ) : (
              <div className="space-y-3">
                {activityItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.path)}
                      className="flex w-full items-center gap-4 rounded-[1.35rem] bg-[#F8F5F2] p-4 text-left transition hover:bg-white"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#385144] shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-[#385144]">{item.title}</p>
                          {item.time && <span className="text-xs font-bold text-[#9AA39B]">{item.time}</span>}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[#6C756C]">{item.text}</p>
                      </div>
                      <div className="hidden text-right md:block">
                        <p className="text-sm font-black text-[#8A5A3F]">{item.meta}</p>
                        <ArrowRight className="ml-auto mt-1 h-4 w-4 text-[#9AA39B]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[1.9rem] border border-white/80 bg-white/86 p-6 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">navigation</p>
                <h3 className="text-2xl font-black text-[#385144]">Разделы</h3>
              </div>
              <LayoutGrid className="h-6 w-6 text-[#B8795C]" />
            </div>

            <div className="grid grid-cols-1 gap-3">
              {navigationCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.path}
                    onClick={() => navigate(card.path)}
                    className="flex items-center gap-4 rounded-[1.35rem] bg-[#F8F5F2] p-4 text-left transition hover:bg-white"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#385144] shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-[#385144]">{card.title}</p>
                      <p className="text-xs font-semibold text-[#6C756C]">{card.text}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#9AA39B]" />
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {(stats.awaitingPayment > 0 || stats.trainingPending > 0 || stats.needsAdminTime > 0) && (
          <section className="mt-6 rounded-[1.9rem] border border-[#B8795C]/20 bg-[#FFF9F0] p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-[#B8795C]" />
              <div>
                <p className="font-black text-[#385144]">Подсказка дня</p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-[#6C756C]">
                  Начни с карточек “Что требует внимания”: сначала время и оплаты, потом Академия и рассылки. Так админка не превращается в склад красивых блоков.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
