import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Users, 
  Search,
  User,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Calendar,
  TrendingUp,
  Trash2
} from 'lucide-react';
import { AdminBackButton } from '../components/admin/AdminBackButton';
import { ensureAdminSession } from '../lib/adminAuth';
import { deleteClientCompletely } from '../lib/adminClientDeletion';

export const AdminWebUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    checkAuth();
    loadUsers();
  }, []);

  const checkAuth = async () => {
    const { ok } = await ensureAdminSession();
    if (!ok) {
      navigate('/admin-web');
    }
  };

  const loadUsers = async () => {
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: consultationsData } = await supabase
        .from('consultations')
        .select('user_id, created_at')
        .order('created_at', { ascending: false });

      // Группируем консультации по пользователям
      const lastActivity = consultationsData?.reduce((acc: any, c) => {
        if (!acc[c.user_id] || new Date(c.created_at) > new Date(acc[c.user_id])) {
          acc[c.user_id] = c.created_at;
        }
        return acc;
      }, {});

      const enriched = (usersData || []).map(u => ({
        ...u,
        last_activity: lastActivity[u.id] || u.created_at,
        total_consultations: consultationsData?.filter(c => c.user_id === u.id).length || 0,
      }));

      setUsers(enriched);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery || 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.telegram_id?.toString().includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    'Первое знакомство': 'bg-blue-100 text-blue-800',
    'Basic': 'bg-green-100 text-green-800',
    'Silver': 'bg-gray-200 text-gray-800',
    'Gold': 'bg-yellow-100 text-yellow-800',
    'Platinum': 'bg-purple-100 text-purple-800',
  };

  const handleDeleteUser = async (user: any) => {
    if (user.role === 'admin') {
      alert('Админ-аккаунт нельзя удалить этой кнопкой.');
      return;
    }

    const confirmation = window.prompt(
      `Удалить клиента “${user.name || 'без имени'}” полностью?\n\nБудут удалены профиль, записи, история консультаций, заявки на обучение и связи с промокодами.\n\nЧтобы подтвердить, напишите: УДАЛИТЬ`
    );

    if (confirmation !== 'УДАЛИТЬ') return;

    setDeletingId(user.id);

    try {
      await deleteClientCompletely(user);
      await loadUsers();
    } catch (error: any) {
      console.error('Ошибка удаления клиента:', error);
      alert(`Не удалось удалить клиента: ${error?.message || 'ошибка'}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F5F2]">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <AdminBackButton onClick={() => navigate('/admin-web/dashboard')} label="В dashboard" />
          <h1 className="text-2xl font-bold text-[#385144]">Управление клиентами</h1>
          <div></div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Фильтры и поиск */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-gray-100">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по имени, email или Telegram ID..."
                  className="w-full pl-10 pr-4 py-2 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                statusFilter === 'all' ? 'bg-[#385144] text-white' : 'bg-[#F8F5F2] text-[#385144] border border-gray-200'
              }`}
            >
              Все ({users.length})
            </button>
            {['Первое знакомство', 'Basic', 'Silver', 'Gold', 'Platinum'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl font-bold transition ${
                  statusFilter === status ? 'bg-[#385144] text-white' : 'bg-[#F8F5F2] text-[#385144] border border-gray-200'
                }`}
              >
                {status} ({users.filter(u => u.status === status).length})
              </button>
            ))}
          </div>
        </div>

        {/* Список клиентов */}
        {loading ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500">Загрузка...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Клиенты не найдены</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => {
              const personalTarologistUntil = user.personal_tarologist_until ? new Date(user.personal_tarologist_until) : null;
              const hasActivePersonalTarologist = Boolean(personalTarologistUntil && personalTarologistUntil >= new Date());

              return (
              <div key={user.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#385144] to-[#6B4EE6] rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h3 className="text-[#385144] font-bold text-lg flex items-center gap-2">
                        {user.name || 'Без имени'}
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[user.status] || 'bg-gray-100 text-gray-800'}`}>
                          {user.status}
                        </span>
                        {hasActivePersonalTarologist && (
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#D4AF37] text-white">
                            Личное ведение
                          </span>
                        )}
                      </h3>
                      <div className="flex gap-4 mt-2 text-sm text-gray-600 flex-wrap">
                        {user.telegram_id && (
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            ID: {user.telegram_id}
                          </span>
                        )}
                        {user.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            {user.email}
                          </span>
                        )}
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {user.phone}
                          </span>
                        )}
                        {user.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {user.city}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 text-right">
                    <div>
                      <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-xl mb-1">
                        <DollarSign className="w-6 h-6" />
                        {user.bonus_balance || 0} ₽
                      </div>
                      <p className="text-gray-500 text-sm">Бонусный баланс</p>
                    </div>
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleDeleteUser(user)}
                        disabled={deletingId === user.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingId === user.id ? 'Удаляю...' : 'Удалить'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-gray-500 text-xs mb-1 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Всего консультаций
                    </p>
                    <p className="text-[#385144] font-bold text-lg">{user.total_consultations || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Последняя активность
                    </p>
                    <p className="text-[#385144] font-bold text-sm">
                      {user.last_activity 
                        ? format(new Date(user.last_activity), 'dd MMM yyyy', { locale: ru })
                        : 'Нет активности'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Дата регистрации</p>
                    <p className="text-[#385144] font-bold text-sm">
                      {format(new Date(user.created_at), 'dd MMM yyyy', { locale: ru })}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Роль</p>
                    <p className="text-[#385144] font-bold text-sm capitalize">
                      {user.role === 'admin' ? '👑 Админ' : '👤 Клиент'}
                    </p>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
