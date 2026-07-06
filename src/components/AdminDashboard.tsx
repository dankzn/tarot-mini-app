import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AdminSlotsManager } from './AdminSlotsManager';
import { AdminConsultationsManager } from './AdminConsultationsManager';
import { ServicesManager } from './admin/ServicesManager';
import { Analytics } from './admin/Analytics';
import { ClientsManager } from './admin/ClientsManager';
import { PaymentMethodsManager } from './admin/PaymentMethodsManager';
import { PromoCodesManager } from './admin/PromoCodesManager';
import { TrainingManager } from './admin/TrainingManager';
import {
  Crown,
  CalendarDays,
  ListChecks,
  Users,
  UserCheck,
  Sparkles,
  Settings,
  BarChart3,
  UserCog,
  CreditCard,
  TicketPercent,
  GraduationCap
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: any;
}

export const AdminDashboard = ({ currentUser }: AdminDashboardProps) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSlotsManager, setShowSlotsManager] = useState(false);
  const [showConsultationsManager, setShowConsultationsManager] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'services' | 'analytics' | 'clients' | 'payments' | 'promo' | 'training'>('dashboard');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalConsultations: 0,
    pendingConsultations: 0,
    totalRevenue: 0,
    awaitingPayment: 0,
    markedPaid: 0,
    needsAdminTime: 0,
    awaitingClientConfirmation: 0,
    clientCountered: 0,
    moneyInWork: 0,
  });

  useEffect(() => {
    loadData();

    const intervalId = window.setInterval(loadData, 30000);
    const refreshOnFocus = () => loadData();
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, []);

  const loadData = async () => {
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersData) setUsers(usersData);

      const { data: consultationsData } = await supabase
        .from('consultations')
        .select('status, scheduling_status, payment_status, price, payment_amount');

      const totalConsultations = consultationsData?.length || 0;
      const pendingConsultations = consultationsData?.filter(c => (
        c.status === 'pending' || ['needs_admin_time', 'client_countered'].includes(c.scheduling_status)
      )).length || 0;
      const completedConsultations = consultationsData?.filter(c => c.status === 'completed') || [];
      const awaitingPaymentConsultations = consultationsData?.filter(c => c.status === 'awaiting_payment') || [];
      const totalRevenue = completedConsultations.reduce((sum, c) => sum + (c.payment_amount || c.price || 0), 0) || 0;

      setStats({
        totalUsers: usersData?.length || 0,
        totalConsultations,
        pendingConsultations,
        totalRevenue,
        awaitingPayment: awaitingPaymentConsultations.length,
        markedPaid: awaitingPaymentConsultations.filter(c => c.payment_status === 'marked_paid').length,
        needsAdminTime: consultationsData?.filter(c => c.scheduling_status === 'needs_admin_time').length || 0,
        awaitingClientConfirmation: consultationsData?.filter(c => c.scheduling_status === 'awaiting_client_confirmation').length || 0,
        clientCountered: consultationsData?.filter(c => c.scheduling_status === 'client_countered').length || 0,
        moneyInWork: awaitingPaymentConsultations.reduce((sum, c) => sum + (c.payment_amount || c.price || 0), 0),
      });
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const adminFocusText = stats.pendingConsultations > 0
    ? `${stats.pendingConsultations} заявок ждут решения. Лучше начать с записей и быстро закрыть очередь.`
    : 'Очередь заявок чистая. Можно проверить окна, услуги или клиентскую базу.';

  // Показываем менеджер слотов
  if (showSlotsManager) {
    return <AdminSlotsManager admin={currentUser} onBack={() => setShowSlotsManager(false)} />;
  }

  // Показываем менеджер консультаций
  if (showConsultationsManager) {
    return <AdminConsultationsManager admin={currentUser} onBack={() => setShowConsultationsManager(false)} />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_42%,#EFE6DA_100%)] p-4 text-[#2F463B]">
      {/* Шапка */}
      <div className="mb-5 rounded-[1.75rem] border border-white/80 bg-white/80 p-4 shadow-[0_16px_40px_rgba(56,81,68,0.10)]">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center">
            <div className="mr-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#385144] text-white">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A5A3F]/70">admin space</p>
              <h1 className="text-xl font-black leading-tight text-[#385144]">Панель администратора</h1>
            </div>
          </div>
          <div className="bg-[#385144] px-3 py-2 rounded-full text-xs text-white font-bold flex items-center">
            <UserCheck className="w-4 h-4 mr-1" />
            {currentUser.name}
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/80 bg-white/65 p-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`rounded-xl px-4 py-2 font-bold whitespace-nowrap transition ${
            activeTab === 'dashboard'
              ? 'bg-[#385144] text-white shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-1" />
          Главная
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`rounded-xl px-4 py-2 font-bold whitespace-nowrap transition ${
            activeTab === 'services'
              ? 'bg-[#385144] text-white shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <ListChecks className="w-4 h-4 inline mr-1" />
          Услуги
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`rounded-xl px-4 py-2 font-bold whitespace-nowrap transition ${
            activeTab === 'analytics'
              ? 'bg-[#385144] text-white shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-1" />
          Аналитика
        </button>
        <button
          onClick={() => setActiveTab('clients')}
          className={`rounded-xl px-4 py-2 font-bold whitespace-nowrap transition ${
            activeTab === 'clients'
              ? 'bg-[#385144] text-white shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <UserCog className="w-4 h-4 inline mr-1" />
          Клиенты
        </button>
        <button
          onClick={() => setActiveTab('training')}
          className={`rounded-xl px-4 py-2 font-bold whitespace-nowrap transition ${
            activeTab === 'training'
              ? 'bg-[#385144] text-white shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <GraduationCap className="w-4 h-4 inline mr-1" />
          Обучение
        </button>
        <button
          onClick={() => setActiveTab('promo')}
          className={`rounded-xl px-4 py-2 font-bold whitespace-nowrap transition ${
            activeTab === 'promo'
              ? 'bg-[#385144] text-white shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <TicketPercent className="w-4 h-4 inline mr-1" />
          Промо
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`rounded-xl px-4 py-2 font-bold whitespace-nowrap transition ${
            activeTab === 'payments'
              ? 'bg-[#385144] text-white shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <CreditCard className="w-4 h-4 inline mr-1" />
          Оплата
        </button>
      </div>

      {/* Контент вкладок */}
      {activeTab === 'dashboard' && (
        <>
          {/* Статистика */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-[1.4rem] border border-white/80 bg-white/80 p-4 shadow-[0_12px_30px_rgba(56,81,68,0.08)]">
              <div className="flex items-center mb-2">
                <Users className="w-5 h-5 text-[#B8795C] mr-2" />
                <span className="text-gray-500 text-xs">Пользователи</span>
              </div>
              <p className="text-[#385144] font-black text-2xl">{stats.totalUsers}</p>
            </div>

            <div className="rounded-[1.4rem] border border-white/80 bg-white/80 p-4 shadow-[0_12px_30px_rgba(56,81,68,0.08)]">
              <div className="flex items-center mb-2">
                <ListChecks className="w-5 h-5 text-[#B8795C] mr-2" />
                <span className="text-gray-500 text-xs">Записи</span>
              </div>
              <p className="text-[#385144] font-black text-2xl">{stats.totalConsultations}</p>
              {stats.pendingConsultations > 0 && (
                <p className="text-yellow-600 text-xs mt-1">
                  ⏳ {stats.pendingConsultations} ожидают
                </p>
              )}
            </div>

            <div className="rounded-[1.4rem] border border-white/80 bg-[#385144] p-4 text-white shadow-[0_16px_40px_rgba(56,81,68,0.16)] col-span-2">
              <div className="flex items-center mb-2">
                <Sparkles className="w-5 h-5 text-[#F4E7C8] mr-2" />
                <span className="text-white/70 text-xs">Доход подтверждённых</span>
              </div>
              <p className="font-black text-2xl">{stats.totalRevenue.toLocaleString()} ₽</p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3">
            {[
              { label: 'Ждут оплаты', value: stats.awaitingPayment, hint: `${stats.markedPaid} отметили оплату` },
              { label: 'В работе', value: `${stats.moneyInWork.toLocaleString()} ₽`, hint: 'до подтверждения оплаты' },
              { label: 'Без времени', value: stats.needsAdminTime, hint: 'предложить слот' },
              { label: 'Ответ клиента', value: stats.awaitingClientConfirmation + stats.clientCountered, hint: 'подтвердить/разобрать' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => setShowConsultationsManager(true)}
                className="rounded-[1.3rem] border border-white/80 bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(56,81,68,0.08)]"
              >
                <p className="text-2xl font-black text-[#385144]">{item.value}</p>
                <p className="mt-1 text-sm font-black text-[#385144]">{item.label}</p>
                <p className="mt-1 text-xs font-semibold text-[#6C756C]">{item.hint}</p>
              </button>
            ))}
          </div>

          <div className="premium-surface mb-6 rounded-[1.75rem] p-5">
            <div className="premium-content">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="luxury-kicker mb-1">daily focus</p>
                  <h2 className="text-xl font-black text-[#385144]">Операционный фокус</h2>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#385144] text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
              <p className="mb-4 text-sm font-semibold leading-relaxed text-[#5E675D]">
                {adminFocusText}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setShowConsultationsManager(true)}
                  className="rounded-2xl bg-white/72 px-3 py-3 text-xs font-black text-[#385144] ring-1 ring-[#385144]/8"
                >
                  Записи
                </button>
                <button
                  onClick={() => setActiveTab('services')}
                  className="rounded-2xl bg-white/72 px-3 py-3 text-xs font-black text-[#385144] ring-1 ring-[#385144]/8"
                >
                  Услуги
                </button>
                <button
                  onClick={() => setActiveTab('clients')}
                  className="rounded-2xl bg-white/72 px-3 py-3 text-xs font-black text-[#385144] ring-1 ring-[#385144]/8"
                >
                  Клиенты
                </button>
              </div>
            </div>
          </div>

          {/* Кнопки управления */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <button
              onClick={() => setShowConsultationsManager(true)}
              className="w-full bg-white/80 text-[#385144] p-4 rounded-2xl font-bold hover:bg-white transition flex items-center justify-between border border-white/80 shadow-[0_12px_30px_rgba(56,81,68,0.08)]"
            >
              <div className="flex items-center">
                <ListChecks className="w-5 h-5 mr-3 text-[#B8795C]" />
                <div className="text-left">
                  <div className="font-bold">Управление записями</div>
                  <div className="text-xs text-gray-500 font-normal">
                    {stats.pendingConsultations > 0
                      ? `${stats.pendingConsultations} ожидают подтверждения`
                      : 'Все записи обработаны'}
                  </div>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </button>

            <button
              onClick={() => setShowSlotsManager(true)}
              className="w-full bg-white/80 text-[#385144] p-4 rounded-2xl font-bold hover:bg-white transition flex items-center justify-between border border-white/80 shadow-[0_12px_30px_rgba(56,81,68,0.08)]"
            >
              <div className="flex items-center">
                <CalendarDays className="w-5 h-5 mr-3 text-[#B8795C]" />
                <div className="text-left">
                  <div className="font-bold">Управление окнами</div>
                  <div className="text-xs text-gray-500 font-normal">
                    Создавать слоты для записи
                  </div>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          </div>

          {/* Список пользователей */}
          <div>
            <h3 className="text-[#385144] font-bold mb-3 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Пользователи ({users.length})
            </h3>

            {loading ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                <p className="text-gray-500">Загрузка данных...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="bg-white/80 p-4 rounded-2xl border border-white/80 shadow-[0_12px_30px_rgba(56,81,68,0.08)]"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-[#385144] font-bold text-lg">{user.name}</h3>
                        <p className="text-gray-500 text-xs">
                          Telegram ID: {user.telegram_id}
                        </p>
                        {user.city && (
                          <p className="text-gray-500 text-xs mt-1">📍 {user.city}</p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        user.role === 'admin'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.role === 'admin' ? 'ADMIN' : 'КЛИЕНТ'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#F8F5F2] p-2 rounded-lg">
                        <p className="text-xs text-gray-500">Статус</p>
                        <p className="text-[#385144] font-bold text-sm">{user.status || 'Первое знакомство'}</p>
                      </div>
                      <div className="bg-[#F8F5F2] p-2 rounded-lg">
                        <p className="text-xs text-gray-500">Баланс</p>
                        <p className="text-[#8A5A3F] font-bold text-sm">{user.bonus_balance || 0} ₽</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'services' && <ServicesManager />}
      {activeTab === 'analytics' && <Analytics />}
      {activeTab === 'clients' && <ClientsManager />}
      {activeTab === 'training' && <TrainingManager />}
      {activeTab === 'payments' && <PaymentMethodsManager />}
      {activeTab === 'promo' && <PromoCodesManager />}
    </div>
  );
};
