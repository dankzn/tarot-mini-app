import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  CalendarCheck, 
  CalendarDays, 
  Send, 
  LogOut,
  TrendingUp,
  DollarSign,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ensureAdminSession } from '../lib/adminAuth';

export const AdminWebDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalConsultations: 0,
    pendingConsultations: 0,
    totalRevenue: 0,
    weekRevenue: 0,
    conversionRate: 0,
    todayConsultations: 0,
    newUsers: 0,
    activeCampaigns: 0,
  });
  const [recentConsultations, setRecentConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const { ok } = await ensureAdminSession();
    if (!ok) {
      navigate('/admin-web');
    }
  };

  const loadData = async () => {
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, created_at');
      
      const { data: consultationsData } = await supabase
        .from('consultations')
        .select('status, price, scheduled_at, users(name)')
        .order('scheduled_at', { ascending: false });

      const { data: recentData } = await supabase
        .from('consultations')
        .select('status, price, scheduled_at, users(name)')
        .order('scheduled_at', { ascending: false })
        .limit(10);

      const { data: servicesData } = await supabase
        .from('services')
        .select('id, promo_starts_at, promo_ends_at, price_increase_at');

      const completedConsultations = consultationsData?.filter(c => c.status === 'completed') || [];
      const totalRevenue = completedConsultations.reduce((sum, c) => sum + (c.price || 0), 0) || 0;
      const pendingCount = consultationsData?.filter(c => c.status === 'pending').length || 0;
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const weekRevenue = completedConsultations
        .filter(c => c.scheduled_at && new Date(c.scheduled_at) >= sevenDaysAgo)
        .reduce((sum, c) => sum + (c.price || 0), 0);
      const conversionRate = consultationsData?.length
        ? Math.round((completedConsultations.length / consultationsData.length) * 100)
        : 0;
      const todayCount = consultationsData?.filter(c => {
        if (!c.scheduled_at) return false;
        const scheduledAt = new Date(c.scheduled_at);
        return scheduledAt >= startOfDay && scheduledAt <= endOfDay;
      }).length || 0;
      const newUsers = usersData?.filter(user => (
        user.created_at && new Date(user.created_at) >= sevenDaysAgo
      )).length || 0;
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
        pendingConsultations: pendingCount,
        totalRevenue,
        weekRevenue,
        conversionRate,
        todayConsultations: todayCount,
        newUsers,
        activeCampaigns,
      });

      setRecentConsultations(recentData || []);
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

  const focusItems = [
    {
      title: stats.pendingConsultations > 0 ? 'Разобрать очередь заявок' : 'Очередь чистая',
      text: stats.pendingConsultations > 0
        ? `${stats.pendingConsultations} записей ждут решения: подтвердить, предложить время или перенести.`
        : 'Новых неподтверждённых заявок нет — можно заняться клиентской базой или рассылкой.',
      action: 'К записям',
      path: '/admin-web/consultations',
    },
    {
      title: stats.activeCampaigns > 0 ? 'Акции и цены активны' : 'Промо-центр спокойный',
      text: stats.activeCampaigns > 0
        ? `${stats.activeCampaigns} услуг сейчас с акцией или будущей сменой цены.`
        : 'Можно запланировать мягкий повод для записи или проверить витрину услуг.',
      action: 'К услугам',
      path: '/admin-web/services',
    },
    {
      title: stats.newUsers > 0 ? 'Есть новые клиенты' : 'Новых клиентов за неделю нет',
      text: stats.newUsers > 0
        ? `${stats.newUsers} новых профилей за 7 дней — хорошее время для персонального касания.`
        : 'Стоит посмотреть аналитику и понять, какой вход в воронку усилить.',
      action: stats.newUsers > 0 ? 'К клиентам' : 'К аналитике',
      path: stats.newUsers > 0 ? '/admin-web/clients' : '/admin-web/analytics',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F5F2] flex items-center justify-center">
        <div className="text-[#385144]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_42%,#EFE6DA_100%)] text-[#2F463B]">
      {/* Шапка */}
      <div className="border-b border-white/70 bg-white/75 shadow-[0_12px_35px_rgba(56,81,68,0.08)] backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">
              tarot operations
            </p>
            <h1 className="text-3xl font-black text-[#385144]">Админ-панель</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center rounded-2xl border border-[#385144]/10 bg-white/75 px-4 py-3 font-bold text-[#5E675D] transition hover:border-red-200 hover:text-red-600"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Выйти
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
            <div className="flex items-center mb-3">
              <Users className="w-6 h-6 text-[#B8795C] mr-3" />
              <span className="text-gray-500 text-sm">Всего клиентов</span>
            </div>
            <p className="text-3xl font-black text-[#385144]">{stats.totalUsers}</p>
          </div>

          <div className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
            <div className="flex items-center mb-3">
              <CalendarCheck className="w-6 h-6 text-[#B8795C] mr-3" />
              <span className="text-gray-500 text-sm">Всего записей</span>
            </div>
            <p className="text-3xl font-black text-[#385144]">{stats.totalConsultations}</p>
          </div>

          <div className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
            <div className="flex items-center mb-3">
              <Clock className="w-6 h-6 text-yellow-600 mr-3" />
              <span className="text-gray-500 text-sm">Ожидают</span>
            </div>
            <p className="text-3xl font-black text-yellow-700">{stats.pendingConsultations}</p>
          </div>

          <div className="rounded-[1.5rem] border border-white/80 bg-[#385144] p-5 text-white shadow-[0_18px_44px_rgba(56,81,68,0.18)]">
            <div className="flex items-center mb-3">
              <DollarSign className="w-6 h-6 text-[#F4E7C8] mr-3" />
              <span className="text-white/70 text-sm">Доход завершённых</span>
            </div>
            <p className="text-3xl font-black">{stats.totalRevenue.toLocaleString()} ₽</p>
          </div>
        </div>

        <div className="mb-8 overflow-hidden rounded-[2rem] border border-white/80 bg-[#385144] p-6 text-white shadow-[0_22px_55px_rgba(56,81,68,0.20)]">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/55">
                control room
              </p>
              <h2 className="mt-1 text-3xl font-black">Пульт управления</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
                Всё важное на сегодня: заявки, клиенты, акции и ближайшие действия.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin-web/consultations')}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#385144]"
            >
              Открыть записи
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            {[
              { label: 'Сегодня записей', value: stats.todayConsultations, hint: 'по расписанию', icon: CalendarDays },
              { label: 'Новые клиенты', value: stats.newUsers, hint: 'за 7 дней', icon: Users },
              { label: 'Активные акции', value: stats.activeCampaigns, hint: 'или будущие цены', icon: Sparkles },
              { label: 'Очередь заявок', value: stats.pendingConsultations, hint: 'нужно подтвердить', icon: Clock },
              { label: 'Доход недели', value: `${stats.weekRevenue.toLocaleString()} ₽`, hint: 'завершённые', icon: DollarSign },
              { label: 'Конверсия', value: `${stats.conversionRate}%`, hint: 'в завершение', icon: TrendingUp },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className="rounded-[1.35rem] bg-white/10 p-4 ring-1 ring-white/10">
                  <div className="mb-4 flex items-center justify-between">
                    <Icon className="h-5 w-5 text-[#F4E7C8]" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">{item.hint}</span>
                  </div>
                  <p className="text-3xl font-black">{item.value}</p>
                  <p className="mt-1 text-sm font-semibold text-white/72">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="premium-surface mb-8 rounded-[2rem] p-6">
          <div className="premium-content">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="luxury-kicker mb-1">morning brief</p>
                <h2 className="text-2xl font-black text-[#385144]">Операционный фокус</h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-[#5E675D]">
                  Три подсказки, куда смотреть в первую очередь, чтобы админка не была просто набором таблиц.
                </p>
              </div>
              <span className="rounded-full bg-[#385144]/10 px-4 py-2 text-sm font-black text-[#385144]">
                Сегодня
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {focusItems.map((item) => (
                <button
                  key={item.title}
                  onClick={() => navigate(item.path)}
                  className="rounded-[1.35rem] bg-white/70 p-4 text-left ring-1 ring-[#385144]/8 transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <p className="text-lg font-black text-[#385144]">{item.title}</p>
                  <p className="mt-2 min-h-[3rem] text-sm font-semibold leading-relaxed text-[#6C756C]">
                    {item.text}
                  </p>
                  <span className="mt-4 inline-flex rounded-full bg-[#385144] px-3 py-1.5 text-xs font-black text-white">
                    {item.action}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Новые карточки */}
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
	  <a
	    href="/admin-web/services"
	    className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 shadow-[0_14px_34px_rgba(56,81,68,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(56,81,68,0.12)]"
	  >
	    <div className="flex items-center mb-3">
	      <div className="w-12 h-12 bg-[#B8795C] rounded-2xl flex items-center justify-center mr-4">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <div>
        <h3 className="font-bold text-[#385144]">Услуги</h3>
        <p className="text-sm text-gray-500">Управление услугами и ценами</p>
      </div>
    </div>
  </a>

	  <a
	    href="/admin-web/analytics"
	    className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 shadow-[0_14px_34px_rgba(56,81,68,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(56,81,68,0.12)]"
	  >
	    <div className="flex items-center mb-3">
	      <div className="w-12 h-12 bg-[#8A5A3F] rounded-2xl flex items-center justify-center mr-4">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <div>
        <h3 className="font-bold text-[#385144]">Аналитика</h3>
        <p className="text-sm text-gray-500">Графики и статистика</p>
      </div>
    </div>
  </a>

	  <a
	    href="/admin-web/clients"
	    className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 shadow-[0_14px_34px_rgba(56,81,68,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(56,81,68,0.12)]"
	  >
	    <div className="flex items-center mb-3">
	      <div className="w-12 h-12 bg-[#385144] rounded-2xl flex items-center justify-center mr-4">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </div>
      <div>
        <h3 className="font-bold text-[#385144]">Клиенты</h3>
        <p className="text-sm text-gray-500">Редактирование данных</p>
      </div>
    </div>
  </a>
</div>

        {/* Быстрые действия */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 mt-6">
          <button 
            onClick={() => navigate('/admin-web/consultations')}
            className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 text-left shadow-[0_14px_34px_rgba(56,81,68,0.08)] transition hover:-translate-y-0.5"
            >
            <CalendarCheck className="w-8 h-8 text-[#B8795C] mb-3" />
            <h3 className="text-[#385144] font-bold text-lg mb-1">Управление записями</h3>
            <p className="text-gray-500 text-sm">Подтверждение и отмена записей</p>
            </button>

          <button 
            onClick={() => navigate('/admin-web/slots')}
            className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 text-left shadow-[0_14px_34px_rgba(56,81,68,0.08)] transition hover:-translate-y-0.5"
            >
            <CalendarDays className="w-8 h-8 text-[#B8795C] mb-3" />
            <h3 className="text-[#385144] font-bold text-lg mb-1">Управление окнами</h3>
            <p className="text-gray-500 text-sm">Создание слотов для записи</p>
            </button>

          <button 
            onClick={() => navigate('/admin-web/mailings')}
            className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 text-left shadow-[0_14px_34px_rgba(56,81,68,0.08)] transition hover:-translate-y-0.5"
            >
            <Send className="w-8 h-8 text-[#B8795C] mb-3" />
            <h3 className="text-[#385144] font-bold text-lg mb-1">Рассылка акций</h3>
            <p className="text-gray-500 text-sm">Отправка уведомлений клиентам</p>
            </button>

          <button 
            onClick={() => navigate('/admin-web/users')}
            className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 text-left shadow-[0_14px_34px_rgba(56,81,68,0.08)] transition hover:-translate-y-0.5"
            >
            <Users className="w-8 h-8 text-[#B8795C] mb-3" />
            <h3 className="text-[#385144] font-bold text-lg mb-1">Список клиентов</h3>
            <p className="text-gray-500 text-sm">Просмотр и управление клиентами</p>
            </button>
        </div>

        {/* Последние записи */}
        <div className="rounded-[1.75rem] border border-white/80 bg-white/85 p-6 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
          <h3 className="text-[#385144] font-bold text-xl mb-4 flex items-center">
            <TrendingUp className="w-6 h-6 mr-2" />
            Последние записи
          </h3>
          
          {recentConsultations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Записей пока нет</p>
          ) : (
            <div className="space-y-3">
              {recentConsultations.map((consultation) => (
                <div key={consultation.id} className="flex justify-between items-center p-4 bg-[#F8F5F2] rounded-2xl">
                  <div>
                    <p className="text-[#385144] font-bold">{consultation.users?.name || 'Клиент'}</p>
                    <p className="text-gray-500 text-sm">
                      {new Date(consultation.scheduled_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#8A5A3F] font-bold">{consultation.price} ₽</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      consultation.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      consultation.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                      consultation.status === 'completed' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {consultation.status === 'pending' ? 'Ожидает' :
                       consultation.status === 'confirmed' ? 'Подтверждена' :
                       consultation.status === 'completed' ? 'Завершена' : 'Отменена'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
