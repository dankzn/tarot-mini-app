import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar, 
  User, 
  DollarSign,
  Filter,
  Search,
  MessageSquare,
  FileText,
  Sparkles
} from 'lucide-react';

export const AdminWebConsultations = () => {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<any>(null);
  const [completeData, setCompleteData] = useState({
    admin_notes: '',
    new_price: 0,
  });

  useEffect(() => {
    checkAuth();
    loadConsultations();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/admin-web');
    }
  };

  const loadConsultations = async () => {
    try {
      const { data: consultationsData } = await supabase
        .from('consultations')
        .select('*')
        .order('scheduled_at', { ascending: false });

      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, telegram_id, city, status, bonus_balance');

      const { data: servicesData } = await supabase
        .from('services')
        .select('id, title, price');

      const enriched = (consultationsData || []).map(c => ({
        ...c,
        users: usersData?.find(u => u.id === c.user_id) || null,
        services: servicesData?.find(s => s.id === c.service_id) || null,
      }));

      setConsultations(enriched);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (consultationId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('consultations')
        .update({ status: newStatus })
        .eq('id', consultationId);

      if (error) throw error;
      
      await loadConsultations();
      alert('✅ Статус обновлён!');
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const openCompleteForm = (consultation: any) => {
    setSelectedConsultation(consultation);
    setCompleteData({
      admin_notes: consultation.admin_notes || '',
      new_price: consultation.price || consultation.services?.price || 0,
    });
    setShowCompleteForm(true);
  };

  const handleComplete = async () => {
    if (!selectedConsultation) return;

    try {
      const completedConsultations = consultations.filter(c => 
        c.user_id === selectedConsultation.user_id && 
        c.status === 'completed' &&
        c.id !== selectedConsultation.id
      );
      
      const totalCompleted = completedConsultations.length + 1;
      let newStatus = 'Первое знакомство';
      
      if (totalCompleted === 0) newStatus = 'Первое знакомство';
      else if (totalCompleted <= 2) newStatus = 'Basic';
      else if (totalCompleted <= 5) newStatus = 'Silver';
      else if (totalCompleted <= 10) newStatus = 'Gold';
      else if (totalCompleted <= 20) newStatus = 'Platinum';
      else newStatus = 'Личное ведение';
      
      const bonusUsed = selectedConsultation.bonus_used || 0;
      const finalPrice = completeData.new_price;
      const bonusEarned = Math.floor(finalPrice * 0.05);
      
      const currentBonusBalance = selectedConsultation.users?.bonus_balance || 0;
      const newBonusBalance = currentBonusBalance - bonusUsed + bonusEarned;

      await supabase
        .from('consultations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          admin_notes: completeData.admin_notes,
          price: finalPrice,
          bonus_paid: bonusEarned,
        })
        .eq('id', selectedConsultation.id);

      await supabase
        .from('users')
        .update({
          status: newStatus,
          bonus_balance: newBonusBalance,
        })
        .eq('id', selectedConsultation.user_id);

      alert(`✅ Консультация завершена!\n\nСписано: -${bonusUsed} ₽\nНачислено: +${bonusEarned} ₽\nБаланс: ${newBonusBalance} ₽\nСтатус: ${newStatus}`);
      
      setShowCompleteForm(false);
      setSelectedConsultation(null);
      await loadConsultations();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const filteredConsultations = consultations.filter(c => {
    const matchesFilter = filter === 'all' || c.status === filter;
    const matchesSearch = !searchQuery || 
      c.users?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.services?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
    in_progress: 'bg-purple-100 text-purple-800 border-purple-300',
    completed: 'bg-green-100 text-green-800 border-green-300',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Ожидает',
    confirmed: 'Подтверждена',
    in_progress: 'В процессе',
    completed: 'Завершена',
    cancelled: 'Отменена',
  };

  if (showCompleteForm && selectedConsultation) {
    const bonusEarned = Math.floor(completeData.new_price * 0.05);
    const currentBonusBalance = selectedConsultation.users?.bonus_balance || 0;
    const bonusUsed = selectedConsultation.bonus_used || 0;
    const newBonusBalance = currentBonusBalance - bonusUsed + bonusEarned;

    return (
      <div className="min-h-screen bg-[#F8F5F2]">
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <button onClick={() => setShowCompleteForm(false)} className="flex items-center text-gray-600 hover:text-[#385144]">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Назад
            </button>
            <h1 className="text-2xl font-bold text-[#385144]">Завершение консультации</h1>
            <div></div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-gray-100">
            <h3 className="text-[#385144] font-bold text-lg mb-2 flex items-center">
              <User className="w-5 h-5 mr-2" />
              {selectedConsultation.users?.name || 'Клиент'}
            </h3>
            <p className="text-gray-600">
              {selectedConsultation.services?.title} • {format(new Date(selectedConsultation.scheduled_at), 'dd MMMM yyyy HH:mm', { locale: ru })}
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Рекомендации и главное из консультации:
              </label>
              <textarea
                rows={6}
                className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                placeholder="Опишите основные рекомендации..."
                value={completeData.admin_notes}
                onChange={(e) => setCompleteData({ ...completeData, admin_notes: e.target.value })}
              />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Итоговая стоимость (₽):
              </label>
              <input
                type="number"
                className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-[#385144] font-bold focus:outline-none focus:border-[#385144]"
                value={completeData.new_price}
                onChange={(e) => setCompleteData({ ...completeData, new_price: Number(e.target.value) })}
              />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-[#385144] font-bold mb-3 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Финансы:
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Клиент потратил бонусов:</span>
                  <span className="text-red-600 font-bold">-{bonusUsed} ₽</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Клиент заплатил деньгами:</span>
                  <span className="text-[#385144] font-bold">{completeData.new_price} ₽</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Кэшбэк (5% от оплаты):</span>
                  <span className="text-green-600 font-bold">+{bonusEarned} ₽</span>
                </div>
                <div className="h-px bg-gray-200 my-2" />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-700">Старый баланс:</span>
                  <span className="text-[#D4AF37]">{currentBonusBalance} ₽</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-700">Новый баланс:</span>
                  <span className="text-green-600">{newBonusBalance} ₽</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowCompleteForm(false)}
                className="flex-1 bg-gray-200 text-gray-700 p-4 rounded-xl font-bold hover:bg-gray-300 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 bg-[#385144] text-white p-4 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Завершить консультацию
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2]">
      {/* Шапка */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/admin-web/dashboard')} className="flex items-center text-gray-600 hover:text-[#385144]">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Назад
          </button>
          <h1 className="text-2xl font-bold text-[#385144]">Управление записями</h1>
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
                  placeholder="Поиск по имени клиента или услуге..."
                  className="w-full pl-10 pr-4 py-2 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                filter === 'all' ? 'bg-[#385144] text-white' : 'bg-[#F8F5F2] text-[#385144] border border-gray-200'
              }`}
            >
              Все ({consultations.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-[#F8F5F2] text-[#385144] border border-gray-200'
              }`}
            >
              Ожидают ({consultations.filter(c => c.status === 'pending').length})
            </button>
            <button
              onClick={() => setFilter('confirmed')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                filter === 'confirmed' ? 'bg-blue-500 text-white' : 'bg-[#F8F5F2] text-[#385144] border border-gray-200'
              }`}
            >
              Подтверждены ({consultations.filter(c => c.status === 'confirmed').length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                filter === 'completed' ? 'bg-green-500 text-white' : 'bg-[#F8F5F2] text-[#385144] border border-gray-200'
              }`}
            >
              Завершены ({consultations.filter(c => c.status === 'completed').length})
            </button>
          </div>
        </div>

        {/* Список записей */}
        {loading ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500">Загрузка...</p>
          </div>
        ) : filteredConsultations.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500">Записей не найдено</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredConsultations.map((consultation) => {
              const user = consultation.users;
              const service = consultation.services;

              return (
                <div 
                  key={consultation.id} 
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-[#385144] font-bold text-lg flex items-center">
                        <User className="w-5 h-5 mr-2" />
                        {user?.name || 'Неизвестный клиент'}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        Telegram ID: {user?.telegram_id || 'N/A'}
                      </p>
                      {user?.city && (
                        <p className="text-gray-500 text-sm mt-1">{user.city}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[consultation.status]}`}>
                      {statusLabels[consultation.status]}
                    </span>
                  </div>

                  <div className="bg-[#F8F5F2] p-4 rounded-xl mb-4">
                    <p className="text-[#385144] font-bold">{service?.title || 'Услуга удалена'}</p>
                    <div className="flex gap-4 mt-2 text-sm flex-wrap">
                      <span className="text-gray-600 flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {consultation.scheduled_at 
                          ? format(new Date(consultation.scheduled_at), 'dd MMMM yyyy', { locale: ru })
                          : 'Дата не указана'
                        }
                      </span>
                      <span className="text-gray-600 flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {consultation.scheduled_at 
                          ? format(new Date(consultation.scheduled_at), 'HH:mm')
                          : ''
                        }
                      </span>
                      <span className="text-[#D4AF37] font-bold flex items-center">
                        <DollarSign className="w-4 h-4 mr-1" />
                        {consultation.price || service?.price || 0} ₽
                      </span>
                    </div>
                    {consultation.bonus_used > 0 && (
                      <p className="text-gray-500 text-xs mt-2 flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Списано бонусов: {consultation.bonus_used} ₽
                      </p>
                    )}
                  </div>

                  {consultation.notes && (
                    <div className="bg-gray-50 p-3 rounded-xl mb-4">
                      <p className="text-gray-500 text-xs mb-1 flex items-center">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Комментарий клиента:
                      </p>
                      <p className="text-gray-700 text-sm">{consultation.notes}</p>
                    </div>
                  )}

                  {consultation.admin_notes && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-xl mb-4">
                      <p className="text-blue-700 text-xs mb-1 flex items-center">
                        <FileText className="w-3 h-3 mr-1" />
                        Ваши заметки:
                      </p>
                      <p className="text-gray-700 text-sm">{consultation.admin_notes}</p>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {consultation.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateStatus(consultation.id, 'confirmed')}
                          className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-600 transition flex items-center justify-center"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Подтвердить
                        </button>
                        <button
                          onClick={() => updateStatus(consultation.id, 'cancelled')}
                          className="flex-1 bg-red-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-600 transition flex items-center justify-center"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Отменить
                        </button>
                      </>
                    )}

                    {consultation.status === 'confirmed' && (
                      <button
                        onClick={() => openCompleteForm(consultation)}
                        className="flex-1 bg-[#385144] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Завершить
                      </button>
                    )}

                    {consultation.status === 'completed' && (
                      <div className="flex-1 text-green-600 text-sm font-bold py-2 text-center">
                        ✅ Завершена
                      </div>
                    )}

                    {consultation.status === 'cancelled' && (
                      <div className="flex-1 text-red-500 text-sm font-bold py-2 text-center">
                        ❌ Отменена
                      </div>
                    )}
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