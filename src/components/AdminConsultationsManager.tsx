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

// Автоматический расчет статуса по количеству консультаций
const calculateClientStatus = (consultationCount: number): string => {
  if (consultationCount === 0) return 'Первое знакомство';
  if (consultationCount <= 2) return 'Basic';
  if (consultationCount <= 5) return 'Silver';
  if (consultationCount <= 10) return 'Gold';
  if (consultationCount <= 20) return 'Platinum';
  return 'Личное ведение';
};

export const AdminConsultationsManager = ({ onBack }: AdminConsultationsManagerProps) => {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<any>(null);
  const [completeData, setCompleteData] = useState({
    admin_notes: '',
    new_price: 0,
  });

  useEffect(() => {
    loadConsultations();
  }, []);

  const loadConsultations = async () => {
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

    const enrichedConsultations = (consultationsData || []).map(c => ({
      ...c,
      users: usersData?.find(u => u.id === c.user_id) || null,
      services: servicesData?.find(s => s.id === c.service_id) || null,
    }));

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
      // Берем цену, которую клиент заплатил (уже с учетом бонусов), либо цену услуги
      new_price: consultation.price || consultation.services?.price || 0,
    });
    setShowCompleteForm(true);
  };

  const handleCompleteConsultation = async () => {
    if (!selectedConsultation) return;

    try {
      // 1. Считаем количество завершенных консультаций
      const completedConsultations = consultations.filter(c => 
        c.user_id === selectedConsultation.user_id && 
        c.status === 'completed' &&
        c.id !== selectedConsultation.id
      );
      
      const totalCompleted = completedConsultations.length + 1;
      const newStatus = calculateClientStatus(totalCompleted);
      
      // 2. Логика бонусов
      const bonusUsed = selectedConsultation.bonus_used || 0; // Сколько клиент потратил
      const finalPrice = completeData.new_price; // Итоговая цена (которую админ подтвердил)
      
      // Начисляем 10% от той суммы, которую клиент реально заплатил деньгами
      // Если клиент заплатил 0 (полностью бонусами), то кэшбэк 0
      const bonusEarned = Math.floor(finalPrice * 0.10); 
      
      const currentBonusBalance = selectedConsultation.users?.bonus_balance || 0;
      
      // Формула: Баланс - Потрачено + Заработано
      const newBonusBalance = currentBonusBalance - bonusUsed + bonusEarned;

      // 3. Обновляем консультацию
      const { error: consultError } = await supabase
        .from('consultations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          admin_notes: completeData.admin_notes,
          price: finalPrice,
          bonus_paid: bonusEarned, // Сколько мы начислили новых
        })
        .eq('id', selectedConsultation.id);

      if (consultError) throw consultError;

      // 4. Обновляем пользователя (Статус + Баланс)
      const { error: userError } = await supabase
        .from('users')
        .update({
          status: newStatus,
          bonus_balance: newBonusBalance,
        })
        .eq('id', selectedConsultation.user_id);

      if (userError) throw userError;

      alert(`✅ Консультация завершена!\n\nСписано бонусов: -${bonusUsed} ₽\nНачислено новых: +${bonusEarned} ₽\nНовый баланс: ${newBonusBalance} ₽\nСтатус: ${newStatus}`);
      
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

  // Форма завершения
  if (showCompleteForm && selectedConsultation) {
    const bonusEarned = Math.floor(completeData.new_price * 0.05);
    const currentBonusBalance = selectedConsultation.users?.bonus_balance || 0;
    const bonusUsed = selectedConsultation.bonus_used || 0;
    const newBonusBalance = currentBonusBalance - bonusUsed + bonusEarned;

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
          {/* Рекомендации */}
          <div>
            <label className="text-purple-200 text-sm mb-2 block">📝 Рекомендации:</label>
            <textarea
              rows={4}
              className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400"
              value={completeData.admin_notes}
              onChange={(e) => setCompleteData({ ...completeData, admin_notes: e.target.value })}
            />
          </div>

          {/* Цена (Админ может изменить итоговую сумму) */}
          <div>
            <label className="text-purple-200 text-sm mb-2 block">💰 Итоговая стоимость (₽):</label>
            <input
              type="number"
              className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400"
              value={completeData.new_price}
              onChange={(e) => setCompleteData({ ...completeData, new_price: Number(e.target.value) })}
            />
          </div>

          {/* Финансы */}
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-2">
            <h4 className="text-white font-bold mb-2">💰 Финансы:</h4>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Клиент потратил бонусов:</span>
              <span className="text-red-400">-{bonusUsed} ₽</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Клиент заплатил деньгами:</span>
              <span className="text-white">{completeData.new_price} ₽</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Кэшбэк (10% от оплаты):</span>
              <span className="text-green-400">+{bonusEarned} ₽</span>
            </div>
            <div className="h-px bg-gray-700 my-2" />
            <div className="flex justify-between text-sm font-bold">
              <span className="text-white">Старый баланс:</span>
              <span className="text-yellow-400">{currentBonusBalance} ₽</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-white">Новый баланс:</span>
              <span className="text-green-400">{newBonusBalance} ₽</span>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-4">
            <button onClick={() => setShowCompleteForm(false)} className="flex-1 bg-white/10 text-white p-4 rounded-lg font-bold">Отмена</button>
            <button onClick={handleCompleteConsultation} className="flex-1 bg-green-600 text-white p-4 rounded-lg font-bold">✅ Завершить</button>
          </div>
        </div>
      </div>
    );
  }

  // Основной список (без изменений, фильтры и т.д.)
  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">📋 Управление записями</h2>
        <button onClick={onBack} className="text-purple-300">✕</button>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg font-bold ${filter === 'all' ? 'bg-purple-600' : 'bg-white/10'}`}>Все</button>
        <button onClick={() => setFilter('pending')} className={`px-4 py-2 rounded-lg font-bold ${filter === 'pending' ? 'bg-yellow-500' : 'bg-white/10'}`}>Ожидают</button>
        <button onClick={() => setFilter('confirmed')} className={`px-4 py-2 rounded-lg font-bold ${filter === 'confirmed' ? 'bg-blue-500' : 'bg-white/10'}`}>Подтверждены</button>
      </div>

      {loading ? <p>Загрузка...</p> : (
        <div className="space-y-4">
          {filteredConsultations.map((consultation) => (
            <div key={consultation.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-white font-bold">{consultation.users?.name}</h3>
                  <p className="text-gray-400 text-xs">ID: {consultation.users?.telegram_id}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${statusColors[consultation.status]}`}>{statusLabels[consultation.status]}</span>
              </div>
              
              <div className="bg-gray-700/50 p-2 rounded mb-2 text-sm">
                <p className="text-white">{consultation.services?.title}</p>
                <p className="text-purple-300">📅 {format(new Date(consultation.scheduled_at), 'dd MMM HH:mm', { locale: ru })}</p>
                <p className="text-yellow-400 font-bold">{consultation.price} ₽ {consultation.bonus_used > 0 && <span className="text-gray-400 text-xs line-through ml-2">(-{consultation.bonus_used} бонусов)</span>}</p>
              </div>

              <div className="flex gap-2 mt-2">
                {consultation.status === 'pending' && (
                  <>
                    <button onClick={() => updateConsultationStatus(consultation.id, 'confirmed')} className="flex-1 bg-blue-600 text-white p-2 rounded text-sm">✅ Подтвердить</button>
                    <button onClick={() => updateConsultationStatus(consultation.id, 'cancelled')} className="flex-1 bg-red-600 text-white p-2 rounded text-sm">❌ Отменить</button>
                  </>
                )}
                {consultation.status === 'confirmed' && (
                  <button onClick={() => openCompleteForm(consultation)} className="flex-1 bg-green-600 text-white p-2 rounded text-sm">✓ Завершить</button>
                )}
                {consultation.status === 'completed' && <div className="text-green-400 text-sm py-2">Завершено</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};