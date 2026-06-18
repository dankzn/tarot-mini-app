import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AdminSlotsManager } from './AdminSlotsManager';
import { AdminConsultationsManager } from './AdminConsultationsManager';
import { ServicesManager } from './admin/ServicesManager';
import { Analytics } from './admin/Analytics';
import { ClientsManager } from './admin/ClientsManager';
import { 
  Crown, 
  CalendarDays, 
  ListChecks, 
  Users,
  UserCheck,
  Sparkles,
  Settings,
  BarChart3,
  UserCog
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: any;
}

export const AdminDashboard = ({ currentUser }: AdminDashboardProps) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSlotsManager, setShowSlotsManager] = useState(false);
  const [showConsultationsManager, setShowConsultationsManager] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'services' | 'analytics' | 'clients'>('dashboard');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalConsultations: 0,
    pendingConsultations: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    loadData();
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
        .select('status, price');

      const totalConsultations = consultationsData?.length || 0;
      const pendingConsultations = consultationsData?.filter(c => c.status === 'pending').length || 0;
      const totalRevenue = consultationsData?.reduce((sum, c) => sum + (c.price || 0), 0) || 0;

      setStats({
        totalUsers: usersData?.length || 0,
        totalConsultations,
        pendingConsultations,
        totalRevenue,
      });
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  // Показываем менеджер слотов
  if (showSlotsManager) {
    return <AdminSlotsManager admin={currentUser} onBack={() => setShowSlotsManager(false)} />;
  }

  // Показываем менеджер консультаций
  if (showConsultationsManager) {
    return <AdminConsultationsManager admin={currentUser} onBack={() => setShowConsultationsManager(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2] p-4">
      {/* Шапка */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Crown className="w-7 h-7 text-[#D4AF37] mr-2" />
          <h1 className="text-2xl font-bold text-[#385144]">Панель Администратора</h1>
        </div>
        <div className="bg-[#385144] px-4 py-2 rounded-full text-sm text-white font-bold flex items-center">
          <UserCheck className="w-4 h-4 mr-1" />
          {currentUser.name}
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 font-bold whitespace-nowrap ${
            activeTab === 'dashboard' 
              ? 'text-[#385144] border-b-2 border-[#385144]' 
              : 'text-gray-500'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-1" />
          Главная
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`px-4 py-2 font-bold whitespace-nowrap ${
            activeTab === 'services' 
              ? 'text-[#385144] border-b-2 border-[#385144]' 
              : 'text-gray-500'
          }`}
        >
          <ListChecks className="w-4 h-4 inline mr-1" />
          Услуги
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 font-bold whitespace-nowrap ${
            activeTab === 'analytics' 
              ? 'text-[#385144] border-b-2 border-[#385144]' 
              : 'text-gray-500'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-1" />
          Аналитика
        </button>
        <button
          onClick={() => setActiveTab('clients')}
          className={`px-4 py-2 font-bold whitespace-nowrap ${
            activeTab === 'clients' 
              ? 'text-[#385144] border-b-2 border-[#385144]' 
              : 'text-gray-500'
          }`}
        >
          <UserCog className="w-4 h-4 inline mr-1" />
          Клиенты
        </button>
      </div>

      {/* Контент вкладок */}
      {activeTab === 'dashboard' && (
        <>
          {/* Статистика */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center mb-2">
                <Users className="w-5 h-5 text-[#6B4EE6] mr-2" />
                <span className="text-gray-500 text-xs">Пользователи</span>
              </div>
              <p className="text-[#385144] font-bold text-2xl">{stats.totalUsers}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center mb-2">
                <ListChecks className="w-5 h-5 text-[#6B4EE6] mr-2" />
                <span className="text-gray-500 text-xs">Записи</span>
              </div>
              <p className="text-[#385144] font-bold text-2xl">{stats.totalConsultations}</p>
              {stats.pendingConsultations > 0 && (
                <p className="text-yellow-600 text-xs mt-1">
                  ⏳ {stats.pendingConsultations} ожидают
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 col-span-2">
              <div className="flex items-center mb-2">
                <Sparkles className="w-5 h-5 text-[#D4AF37] mr-2" />
                <span className="text-gray-500 text-xs">Общий доход</span>
              </div>
              <p className="text-[#D4AF37] font-bold text-2xl">{stats.totalRevenue.toLocaleString()} ₽</p>
            </div>
          </div>

          {/* Кнопки управления */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <button
              onClick={() => setShowConsultationsManager(true)}
              className="w-full bg-white text-[#385144] p-4 rounded-xl font-bold hover:bg-gray-50 transition flex items-center justify-between border border-gray-100 shadow-sm"
            >
              <div className="flex items-center">
                <ListChecks className="w-5 h-5 mr-3 text-[#6B4EE6]" />
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
              className="w-full bg-white text-[#385144] p-4 rounded-xl font-bold hover:bg-gray-50 transition flex items-center justify-between border border-gray-100 shadow-sm"
            >
              <div className="flex items-center">
                <CalendarDays className="w-5 h-5 mr-3 text-[#6B4EE6]" />
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
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"
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
                        <p className="text-[#D4AF37] font-bold text-sm">{user.bonus_balance || 0} ₽</p>
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
    </div>
  );
};