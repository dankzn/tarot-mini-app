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
    console.log('🔍 Загрузка консультаций...');
    
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
      const bonusUsed = selectedConsultation.bonus_used || 0;
      const finalPrice = completeData.new_price;
      const bonusEarned = Math.floor(finalPrice * 0.10);
      
      const currentBonusBalance = selectedConsultation.users?.bonus_balance || 0;
      const newBonusBalance = currentBonusBalance - bonusUsed + bonusEarned;

      console.log('🔄 Обновление консультации и пользователя...');
      console.log('Бонусы:', { bonusUsed, bonusEarned, currentBonusBalance, newBonusBalance });
      console.log('Статус:', { oldStatus: selectedConsultation.users?.status, newStatus });

      // 3. Обновляем консультацию
      const { error: consultError } = await supabase
        .from('consultations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          admin_notes: completeData.admin_notes,
          price: finalPrice,
          bonus_paid: bonusEarned,
        })
        .eq('id', selectedConsultation.id);

      if (consultError) {
        console.error('❌ Ошибка обновления консультации:', consultError);
        throw consultError;
      }

      console.log('✅ Консультация обновлена');

      // 4. ПРИНУДИТЕЛЬНОЕ обновление пользователя с возвратом данных
      const { data: updatedUser, error: userError } = await supabase
        .from('users')
        .update({
          status: newStatus,
          bonus_balance: newBonusBalance,
        })
        .eq('id', selectedConsultation.user_id)
        .select()
        .single();

      if (userError) {
        console.error('❌ Ошибка обновления пользователя:', userError);
        throw userError;
      }

      console.log('✅ Пользователь обновлен:', updatedUser);

      // 5. Проверяем, что данные действительно обновились в базе
      const { data: verifyUser } = await supabase
        .from('users')
        .select('status, bonus_balance')
        .eq('id', selectedConsultation.user_id)
        .single();

      console.log('🔍 Проверка данных в базе:', verifyUser);

      alert(`✅ Консультация завершена!\n\nСписано бонусов: -${bonusUsed} ₽\nНачислено новых: +${bonusEarned} ₽\nНовый баланс: ${newBonusBalance} ₽\nНовый статус: ${newStatus}`);
      
      setShowCompleteForm(false);
      setSelectedConsultation(null);
      
      // 6. Перезагружаем данные
      await loadConsultations();
      
      // 7. ПРИНУДИТЕЛЬНАЯ перезагрузка всего приложения
      setTimeout(() => {
        window.location.href = window.location.href;
      }, 500);
      
    } catch (error: any) {
      console.error('❌ Ошибка:', error);
      alert('Ошибка: ' + error.message);
    }
  };

  const filteredConsultations = filter === 'all' 
    ? consultations 
    : consultations.filter(c => c.status === filter);

  // Форма завершения консультации
  if (showCompleteForm && selectedConsultation) {
    const bonusEarned = Math.floor(completeData.new_price * 0.10);
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
            <label className="text-purple-200 text-sm mb-2 block">💰 Итоговая стоимость (₽):</label>
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

          {/* Автоматическая смена статуса */}
          <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-xl">
            <h4 className="text-blue-400 font-bold mb-2">👤 Автоматическая смена статуса:</h4>
            <div className="space-y-1 text-sm">
              <p className="text-white">
                Текущий статус: <span className="text-yellow-400">{selectedConsultation.users?.status || 'Первое знакомство'}</span>
              </p>
              <p className="text-white">
                Завершено консультаций: <span className="text-blue-400">{consultations.filter(c => c.user_id === selectedConsultation.user_id && c.status === 'completed').length + 1}</span>
              </p>
              <p className="text-white">
                Новый статус: <span className="text-blue-400 font-bold">{calculateClientStatus(consultations.filter(c => c.user_id === selectedConsultation.user_id && c.status === 'completed').length + 1)}</span>
              </p>
            </div>
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

  // Основной список консультаций
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
                  {consultation.bonus_used > 0 && (
                    <p className="text-gray-400 text-xs mt-1">
                      💎 Списано бонусов: {consultation.bonus_used} ₽
                    </p>
                  )}
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