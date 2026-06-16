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
} from 'lucide-react';

export const AdminWebDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalConsultations: 0,
    pendingConsultations: 0,
    totalRevenue: 0,
  });
  const [recentConsultations, setRecentConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/admin-web');
      return;
    }

    // Проверяем что это админ
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', session.user.id)
      .single();

    if (!adminData) {
      navigate('/admin-web');
    }
  };

  const loadData = async () => {
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('id');
      
      const { data: consultationsData } = await supabase
        .from('consultations')
        .select('status, price, scheduled_at, users(name)')
        .order('scheduled_at', { ascending: false })
        .limit(10);

      const totalRevenue = consultationsData?.reduce((sum, c) => sum + (c.price || 0), 0) || 0;
      const pendingCount = consultationsData?.filter(c => c.status === 'pending').length || 0;

      setStats({
        totalUsers: usersData?.length || 0,
        totalConsultations: consultationsData?.length || 0,
        pendingConsultations: pendingCount,
        totalRevenue,
      });

      setRecentConsultations(consultationsData || []);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F5F2] flex items-center justify-center">
        <div className="text-[#385144]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2]">
      {/* Шапка */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-[#385144]">Админ-панель</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center text-gray-600 hover:text-red-600 transition"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Выйти
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center mb-3">
              <Users className="w-6 h-6 text-[#6B4EE6] mr-3" />
              <span className="text-gray-500 text-sm">Всего клиентов</span>
            </div>
            <p className="text-3xl font-bold text-[#385144]">{stats.totalUsers}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center mb-3">
              <CalendarCheck className="w-6 h-6 text-[#6B4EE6] mr-3" />
              <span className="text-gray-500 text-sm">Всего записей</span>
            </div>
            <p className="text-3xl font-bold text-[#385144]">{stats.totalConsultations}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center mb-3">
              <Clock className="w-6 h-6 text-yellow-600 mr-3" />
              <span className="text-gray-500 text-sm">Ожидают</span>
            </div>
            <p className="text-3xl font-bold text-yellow-600">{stats.pendingConsultations}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center mb-3">
              <DollarSign className="w-6 h-6 text-[#D4AF37] mr-3" />
              <span className="text-gray-500 text-sm">Общий доход</span>
            </div>
            <p className="text-3xl font-bold text-[#D4AF37]">{stats.totalRevenue.toLocaleString()} ₽</p>
          </div>
        </div>

        {/* Быстрые действия */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition text-left">
            <CalendarCheck className="w-8 h-8 text-[#6B4EE6] mb-3" />
            <h3 className="text-[#385144] font-bold text-lg mb-1">Управление записями</h3>
            <p className="text-gray-500 text-sm">Подтверждение и отмена записей</p>
          </button>

          <button className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition text-left">
            <CalendarDays className="w-8 h-8 text-[#6B4EE6] mb-3" />
            <h3 className="text-[#385144] font-bold text-lg mb-1">Управление окнами</h3>
            <p className="text-gray-500 text-sm">Создание слотов для записи</p>
          </button>

          <button className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition text-left">
            <Send className="w-8 h-8 text-[#6B4EE6] mb-3" />
            <h3 className="text-[#385144] font-bold text-lg mb-1">Рассылка акций</h3>
            <p className="text-gray-500 text-sm">Отправка уведомлений клиентам</p>
          </button>
        </div>

        {/* Последние записи */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-[#385144] font-bold text-xl mb-4 flex items-center">
            <TrendingUp className="w-6 h-6 mr-2" />
            Последние записи
          </h3>
          
          {recentConsultations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Записей пока нет</p>
          ) : (
            <div className="space-y-3">
              {recentConsultations.map((consultation) => (
                <div key={consultation.id} className="flex justify-between items-center p-4 bg-[#F8F5F2] rounded-xl">
                  <div>
                    <p className="text-[#385144] font-bold">{consultation.users?.name || 'Клиент'}</p>
                    <p className="text-gray-500 text-sm">
                      {new Date(consultation.scheduled_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#D4AF37] font-bold">{consultation.price} ₽</p>
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