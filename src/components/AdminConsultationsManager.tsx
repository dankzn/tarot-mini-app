import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AdminConsultationsManagerProps {
  admin: any;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  in_progress: 'bg-purple-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  in_progress: 'В процессе',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

const clientStatuses = [
  'Первое знакомство',
  'Basic',
  'Silver',
  'Gold',
  'Platinum',
  'Личное ведение',
];

export const AdminConsultationsManager = ({ onBack }: AdminConsultationsManagerProps) => {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<any>(null);
  const [completeData, setCompleteData] = useState({
    admin_notes: '',
    new_price: 0,
    bonus_earned: 0,
    new_client_status: '',
  });

  useEffect(() => {
    loadConsultations();
  }, []);

  const loadConsultations = async () => {
    console.log(' Загрузка записей...');
    
    const { data: consultationsData, error: consultError } = await supabase
      .from('consultations')
      .select('*')
      .order('scheduled_at', { ascending: false });

    if (consultError) {
      console.error('❌ Ошибка загрузки консультаций:', consultError);
      setLoading(false);
      return;
    }

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, telegram_id, city, status, bonus_balance');

    const { data: servicesData } = await supabase
      .from('services')
      .select('id, title, price');

    const enrichedConsultations = (consultationsData || []).map(c => ({
      ...c,
      users: usersData?.find(u => u.id === c.user_id) || null,
      services: servicesData?.find(s => s.id === c.service_id) || null,
    }));

    console.log('✅ Загружено записей:', enrichedConsultations.length);
    setConsultations(enrichedConsultations);
    setLoading(false);
  };

  const updateConsultationStatus = async (consultationId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('consultations')
        .update({ status: newStatus })
        .eq('id', consultationId);

      if (error) throw error;
      
      setConsultations(consultations.map(c => 
        c.id === consultationId ? { ...c, status: newStatus } : c
      ));
      
      alert('Статус обновлён!');
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const openCompleteForm = (consultation: any) => {
    setSelectedConsultation(consultation);
    setCompleteData({
      admin_notes: consultation.admin_notes || '',
      new_price: consultation.price || consultation.services?.price || 0,
      bonus_earned: Math.floor((consultation.price || consultation.services?.price || 0) * 0.1), // 10% по умолчанию
      new_client_status: consultation.users?.status || 'Первое знакомство',
    });
    setShowCompleteForm(true);
  };

  const handleCompleteConsultation = async () => {
    if (!selectedConsultation) return;

    try {
      // 1. Обновляем консультацию
      const { error: consultError } = await supabase
        .from('consultations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          admin_notes: completeData.admin_notes,
          price: completeData.new_price,
          bonus_paid: completeData.bonus_earned,
        })
        .eq('id', selectedConsultation.id);

      if (consultError) throw consultError;

      // 2. Обновляем статус клиента и баланс бонусов
      const newBonusBalance = (selectedConsultation.users?.bonus_balance || 0) + completeData.bonus_earned;
      
      const { error: userError } = await supabase
        .from('users')
        .update({
          status: completeData.new_client_status,
          bonus_balance: newBonusBalance,
        })
        .eq('id', selectedConsultation.user_id);

      if (userError) throw userError;

      alert('✅ Консультация завершена! Бонусы начислены, статус обновлён.');
      
      setShowCompleteForm(false);
      setSelectedConsultation(null);
      await loadConsultations();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const filteredConsultations = filter === 'all' 
    ? consultations 
    : consultations.filter(c => c.status === filter);

  // Форма завершения консультации
  if (showCompleteForm && selectedConsultation) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">✅ Завершение консультации</h2>
          <button onClick={() => setShowCompleteForm(false)} className="text-purple-300">✕</button>
        </div>

        <div className="bg-gray-800 p-4 rounded-xl mb-6">
          <h3 className="text-white font-bold mb-2">
            {selectedConsultation.users?.name || 'Клиент'}
          </h3>
          <p className="text-purple-300 text-sm">
            {selectedConsultation.services?.title} • {format(new Date(selectedConsultation.scheduled_at), 'dd MMMM yyyy HH:mm', { locale: ru })}
          </p>
        </div>

        <div className="space-y-4">
          {/* Рекомендации и заметки */}
          <div>
            <label className="text-purple-200 text-sm mb-2 block">📝 Рекомендации и главное из консультации:</label>
            <textarea
              rows={6}
              className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
              placeholder="Опишите основные рекомендации, выводы и главное из консультации..."
              value={completeData.admin_notes}
              onChange={(e) => setCompleteData({ ...completeData, admin_notes: e.target.value })}
            />
          </div>

          {/* Изменение стоимости */}
          <div>
            <label className="text-purple-200 text-sm mb-2 block">💰 Стоимость консультации (₽):</label>
            <input
              type="number"
              className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400"
              value={completeData.new_price}
              onChange={(e) => setCompleteData({ ...completeData, new_price: Number(e.target.value) })}
            />
            <p className="text-gray-400 text-xs mt-1">
              Изначальная цена: {selectedConsultation.services?.price || 0} ₽
            </p>
          </div>

          {/* Начисление бонусов */}
          <div>
            <label className="text-purple-200 text-sm mb-2 block">🎁 Бонусы клиенту (₽):</label>
            <input
              type="number"
              className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400"
              value={completeData.bonus_earned}
              onChange={(e) => setCompleteData({ ...completeData, bonus_earned: Number(e.target.value) })}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setCompleteData({ ...completeData, bonus_earned: Math.floor(completeData.new_price * 0.05) })}
                className="px-3 py-1 bg-white/10 text-white text-xs rounded hover:bg-white/20"
              >
                5%
              </button>
              <button
                onClick={() => setCompleteData({ ...completeData, bonus_earned: Math.floor(completeData.new_price * 0.1) })}
                className="px-3 py-1 bg-white/10 text-white text-xs rounded hover:bg-white/20"
              >
                10%
              </button>
              <button
                onClick={() => setCompleteData({ ...completeData, bonus_earned: Math.floor(completeData.new_price * 0.15) })}
                className="px-3 py-1 bg-white/10 text-white text-xs rounded hover:bg-white/20"
              >
                15%
              </button>
              <button
                onClick={() => setCompleteData({ ...completeData, bonus_earned: Math.floor(completeData.new_price * 0.2) })}
                className="px-3 py-1 bg-white/10 text-white text-xs rounded hover:bg-white/20"
              >
                20%
              </button>
            </div>
            <p className="text-gray-400 text-xs mt-1">
              Текущий баланс: {selectedConsultation.users?.bonus_balance || 0} ₽ → Новый: {selectedConsultation.users?.bonus_balance || 0 + completeData.bonus_earned} ₽
            </p>
          </div>

          {/* Смена статуса клиента */}
          <div>
            <label className="text-purple-200 text-sm mb-2 block">👤 Новый статус клиента:</label>
            <select
              className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400"
              value={completeData.new_client_status}
              onChange={(e) => setCompleteData({ ...completeData, new_client_status: e.target.value })}
            >
              {clientStatuses.map((status) => (
                <option key={status} value={status} className="bg-gray-800">
                  {status}
                </option>
              ))}
            </select>
            <p className="text-gray-400 text-xs mt-1">
              Текущий статус: {selectedConsultation.users?.status || 'Первое знакомство'}
            </p>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowCompleteForm(false)}
              className="flex-1 bg-white/10 text-white p-4 rounded-lg font-bold hover:bg-white/20 transition"
            >
              Отмена
            </button>
            <button
              onClick={handleCompleteConsultation}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-800 text-white p-4 rounded-lg font-bold hover:from-green-700 hover:to-green-900 transition"
            >
              ✅ Завершить консультацию
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">📋 Управление записями</h2>
        <button onClick={onBack} className="text-purple-300">✕</button>
      </div>

      {/* Фильтры */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-bold transition ${
            filter === 'all' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white'
          }`}
        >
          Все ({consultations.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-bold transition ${
            filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-white/10 text-white'
          }`}
        >
          Ожидают ({consultations.filter(c => c.status === 'pending').length})
        </button>
        <button
          onClick={() => setFilter('confirmed')}
          className={`px-4 py-2 rounded-lg font-bold transition ${
            filter === 'confirmed' ? 'bg-blue-500 text-white' : 'bg-white/10 text-white'
          }`}
        >
          Подтверждены ({consultations.filter(c => c.status === 'confirmed').length})
        </button>
      </div>

      {loading ? (
        <p className="text-white text-center">Загрузка...</p>
      ) : filteredConsultations.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-400">Записей не найдено</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredConsultations.map((consultation) => {
            const user = consultation.users;
            const service = consultation.services;

            return (
              <div 
                key={consultation.id} 
                className="bg-gray-800 p-4 rounded-xl border border-gray-700"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-white font-bold text-lg">
                      {user?.name || 'Неизвестный клиент'}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Telegram ID: {user?.telegram_id || 'N/A'}
                    </p>
                    {user?.city && (
                      <p className="text-purple-300 text-sm">📍 {user.city}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded text-xs text-white ${statusColors[consultation.status]}`}>
                    {statusLabels[consultation.status]}
                  </span>
                </div>

                <div className="bg-gray-700/50 p-3 rounded-lg mb-3">
                  <p className="text-white font-bold">{service?.title || 'Услуга удалена'}</p>
                  <div className="flex gap-4 mt-2 text-sm flex-wrap">
                    <span className="text-purple-300">
                      📅 {consultation.scheduled_at 
                        ? format(new Date(consultation.scheduled_at), 'dd MMMM yyyy', { locale: ru })
                        : 'Дата не указана'
                      }
                    </span>
                    <span className="text-purple-300">
                      ⏰ {consultation.scheduled_at 
                        ? format(new Date(consultation.scheduled_at), 'HH:mm')
                        : ''
                      }
                    </span>
                    <span className="text-yellow-400 font-bold">
                      {consultation.price || service?.price || 0} ₽
                    </span>
                  </div>
                </div>

                {consultation.notes && (
                  <div className="bg-white/5 p-3 rounded-lg mb-3">
                    <p className="text-gray-400 text-xs mb-1">💬 Комментарий клиента:</p>
                    <p className="text-white text-sm">{consultation.notes}</p>
                  </div>
                )}

                {consultation.admin_notes && (
                  <div className="bg-blue-900/30 p-3 rounded-lg mb-3">
                    <p className="text-blue-300 text-xs mb-1">📝 Ваши заметки:</p>
                    <p className="text-white text-sm">{consultation.admin_notes}</p>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap mt-3">
                  {consultation.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateConsultationStatus(consultation.id, 'confirmed')}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition"
                      >
                        ✅ Подтвердить
                      </button>
                      <button
                        onClick={() => updateConsultationStatus(consultation.id, 'cancelled')}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition"
                      >
                        ❌ Отменить
                      </button>
                    </>
                  )}

                  {consultation.status === 'confirmed' && (
                    <button
                      onClick={() => openCompleteForm(consultation)}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition"
                    >
                      ✓ Завершить
                    </button>
                  )}

                  {consultation.status === 'completed' && (
                    <div className="text-green-400 text-sm font-bold py-2">
                      ✓ Консультация завершена
                    </div>
                  )}

                  {consultation.status === 'cancelled' && (
                    <div className="text-red-400 text-sm font-bold py-2">
                      ✗ Отменена
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};