import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Edit, Save, X, Users, Search, Crown, CalendarCheck, MessageSquare, Trash2 } from 'lucide-react';
import { deleteClientCompletely } from '../../lib/adminClientDeletion';

interface User {
  id: string;
  telegram_id: number;
  name: string;
  username?: string;
  gender?: string;
  status?: string;
  referred_by?: number;
  referrals_count?: number;
  bonus_balance?: number;
  created_at?: string;
  admin_private_notes?: string | null;
  total_consultations?: number;
  completed_consultations?: number;
  total_paid?: number;
  last_consultation_at?: string | null;
  upcoming_consultation_at?: string | null;
  role?: string | null;
}

type ClientFilter = 'all' | 'new' | 'active' | 'upcoming' | 'sleeping' | 'vip';

const filters: Array<{ id: ClientFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'new', label: 'Новые' },
  { id: 'active', label: 'Активные' },
  { id: 'upcoming', label: 'С записью' },
  { id: 'sleeping', label: 'Давно не были' },
  { id: 'vip', label: 'VIP' },
];

export const ClientsManager = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ClientFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    gender: 'other',
    referred_by: '',
    admin_private_notes: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data: usersData, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка загрузки пользователей:', error);
      return;
    }

    const { data: consultationsData } = await supabase
      .from('consultations')
      .select('user_id, status, price, scheduled_at');

    if (usersData) {
      const now = new Date();
      const usersWithStats = await Promise.all(
        usersData.map(async (user) => {
          const userConsultations = (consultationsData || []).filter(c => c.user_id === user.id);
          const completed = userConsultations.filter(c => c.status === 'completed');
          const upcoming = userConsultations
            .filter(c => ['pending', 'confirmed', 'in_progress'].includes(c.status) && c.scheduled_at && new Date(c.scheduled_at) >= now)
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
          const last = [...userConsultations]
            .filter(c => c.scheduled_at)
            .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];
          const { count } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('referred_by', user.telegram_id);

          return {
            ...user,
            referrals_count: count || 0,
            total_consultations: userConsultations.length,
            completed_consultations: completed.length,
            total_paid: completed.reduce((sum, c) => sum + (c.price || 0), 0),
            last_consultation_at: last?.scheduled_at || null,
            upcoming_consultation_at: upcoming?.scheduled_at || null,
          };
        })
      );

      setUsers(usersWithStats);
    }
  };

  const handleEdit = (user: User) => {
    setEditingId(user.id);
    setSelectedUser(user);
    setFormData({
      username: user.username || '',
      gender: user.gender || 'other',
      referred_by: user.referred_by?.toString() || '',
      admin_private_notes: user.admin_private_notes || '',
    });
  };

  const handleSave = async () => {
    if (!editingId) return;

    const updateData: any = {
      username: formData.username.trim() || null,
      gender: formData.gender,
      admin_private_notes: formData.admin_private_notes.trim() || null,
    };

    if (formData.referred_by.trim()) {
      const refId = parseInt(formData.referred_by, 10);
      if (!isNaN(refId)) updateData.referred_by = refId;
    } else {
      updateData.referred_by = null;
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', editingId);

    if (error) {
      alert('Ошибка при сохранении: ' + error.message);
      return;
    }

    setEditingId(null);
    await loadUsers();
  };

  const handleCancel = () => {
    setEditingId(null);
    setSelectedUser(null);
    setFormData({ username: '', gender: 'other', referred_by: '', admin_private_notes: '' });
  };

  const handleDeleteUser = async (user: User) => {
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
      setUsers((currentUsers) => currentUsers.filter((item) => item.id !== user.id));
      if (selectedUser?.id === user.id) setSelectedUser(null);
      if (editingId === user.id) handleCancel();
    } catch (error: any) {
      console.error('Ошибка удаления клиента:', error);
      alert(`Не удалось удалить клиента: ${error?.message || 'ошибка'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query
      || user.name?.toLowerCase().includes(query)
      || user.username?.toLowerCase().includes(query)
      || user.telegram_id?.toString().includes(query);
    const createdAt = user.created_at ? new Date(user.created_at) : null;
    const lastAt = user.last_consultation_at ? new Date(user.last_consultation_at) : null;
    const daysAgo30 = new Date();
    daysAgo30.setDate(daysAgo30.getDate() - 30);
    const daysAgo7 = new Date();
    daysAgo7.setDate(daysAgo7.getDate() - 7);

    const matchesFilter =
      activeFilter === 'all'
      || (activeFilter === 'new' && createdAt && createdAt >= daysAgo7)
      || (activeFilter === 'active' && (user.completed_consultations || 0) > 0)
      || (activeFilter === 'upcoming' && Boolean(user.upcoming_consultation_at))
      || (activeFilter === 'sleeping' && (!lastAt || lastAt < daysAgo30))
      || (activeFilter === 'vip' && ['Gold', 'Platinum', 'Личное ведение'].includes(user.status || ''));

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">client control</p>
          <h2 className="mt-1 flex items-center text-3xl font-black text-[#385144]">
            <Users className="mr-2 h-7 w-7" />
            Клиенты
          </h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-white/80 bg-white/85 py-3 pl-10 pr-4 text-sm text-gray-900 shadow-sm md:w-80"
            placeholder="Поиск по имени, username, ID"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map(filter => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`rounded-full px-4 py-2 text-sm font-black transition ${
              activeFilter === filter.id
                ? 'bg-[#385144] text-white'
                : 'bg-white/80 text-[#5E675D] hover:bg-[#EAF1EA]'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {selectedUser && (
        <div className="rounded-[1.75rem] border border-white/80 bg-[#385144] p-5 text-white shadow-[0_18px_44px_rgba(56,81,68,0.16)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">карточка клиента 360°</p>
              <h3 className="mt-1 text-2xl font-black">{selectedUser.name}</h3>
              <p className="mt-1 text-sm text-white/70">@{selectedUser.username || 'не указан'} · ID {selectedUser.telegram_id}</p>
            </div>
            <div className="flex gap-2">
              {selectedUser.role !== 'admin' && (
                <button
                  onClick={() => handleDeleteUser(selectedUser)}
                  disabled={deletingId === selectedUser.id}
                  className="rounded-2xl bg-red-500/15 p-3 text-red-100 transition hover:bg-red-500/25 disabled:opacity-50"
                  title="Удалить клиента полностью"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
              <button onClick={() => setSelectedUser(null)} className="rounded-2xl bg-white/10 p-3">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-4">
              <CalendarCheck className="mb-3 h-5 w-5 text-[#F4E7C8]" />
              <p className="text-2xl font-black">{selectedUser.total_consultations || 0}</p>
              <p className="text-sm text-white/70">записей всего</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <Crown className="mb-3 h-5 w-5 text-[#F4E7C8]" />
              <p className="text-2xl font-black">{selectedUser.status || '—'}</p>
              <p className="text-sm text-white/70">статус</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="mb-3 text-lg font-black text-[#F4E7C8]">₽</p>
              <p className="text-2xl font-black">{(selectedUser.total_paid || 0).toLocaleString()} ₽</p>
              <p className="text-sm text-white/70">сумма оплат</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <MessageSquare className="mb-3 h-5 w-5 text-[#F4E7C8]" />
              <p className="text-sm font-bold leading-relaxed text-white/82">
                {selectedUser.admin_private_notes || 'Заметок пока нет'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div key={user.id} className="rounded-[1.5rem] border border-white/80 bg-white/85 p-4 shadow-[0_12px_30px_rgba(56,81,68,0.08)]">
            {editingId === user.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Пол</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    >
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                      <option value="other">Не указан</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Реферер (telegram_id)</label>
                    <input
                      type="text"
                      value={formData.referred_by}
                      onChange={(e) => setFormData({...formData, referred_by: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Приватная заметка админа</label>
                    <textarea
                      rows={3}
                      value={formData.admin_private_notes}
                      onChange={(e) => setFormData({...formData, admin_private_notes: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                      placeholder="Предпочтения, важные темы, стиль общения..."
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-green-600">
                    <Save className="w-3 h-3" />
                    Сохранить
                  </button>
                  <button onClick={handleCancel} className="bg-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-gray-400">
                    <X className="w-3 h-3" />
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <button onClick={() => setSelectedUser(user)} className="flex-1 text-left">
                  <div className="font-black text-[#385144]">{user.name}</div>
                  <div className="mt-1 text-sm text-gray-500">
                    @{user.username || 'не указан'} • {user.gender === 'male' ? 'М' : user.gender === 'female' ? 'Ж' : '—'}
                    {user.referred_by && <span className="ml-2 text-[#8A5A3F]">• Реферер: {user.referred_by}</span>}
                    {user.referrals_count && user.referrals_count > 0 && <span className="ml-2 font-bold text-green-600">• Привёл: {user.referrals_count}</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#EAF1EA] px-2.5 py-1 text-xs font-bold text-[#385144]">
                      {user.total_consultations || 0} записей
                    </span>
                    <span className="rounded-full bg-[#FFF1E8] px-2.5 py-1 text-xs font-bold text-[#B8795C]">
                      {(user.total_paid || 0).toLocaleString()} ₽
                    </span>
                    {user.upcoming_consultation_at && (
                      <span className="rounded-full bg-[#385144] px-2.5 py-1 text-xs font-bold text-white">
                        ближайшая запись
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex self-start gap-2 md:self-center">
                  <button onClick={() => handleEdit(user)} className="rounded-2xl p-3 text-blue-600 hover:bg-blue-50" title="Редактировать">
                    <Edit className="w-4 h-4" />
                  </button>
                  {user.role !== 'admin' && (
                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={deletingId === user.id}
                      className="rounded-2xl p-3 text-red-500 hover:bg-red-50 disabled:opacity-50"
                      title="Удалить клиента полностью"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="rounded-[1.5rem] bg-white/80 p-8 text-center text-gray-500">
            Клиентов по этому фильтру нет.
          </div>
        )}
      </div>
    </div>
  );
};
