import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './CalendarStyles.css';
import { format, addMinutes, isBefore, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';

interface BookingFormProps {
  user: any; // Здесь ожидается user.bonus_balance
  service: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const BookingForm = ({ user, service, onSuccess, onCancel }: BookingFormProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [allSlots, setAllSlots] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState(1);

  // Состояния для бонусов
  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);

  const duration = service.duration_minutes || 60;
  const originalPrice = service.price || 0;
  const userBalance = user.bonus_balance || 0;

  // Максимум бонусов, которые можно списать (не больше баланса и не больше цены)
  const maxBonusUsable = Math.min(userBalance, originalPrice);
  
  // Итоговая цена к оплате
  const finalPrice = useBonuses ? originalPrice - bonusAmount : originalPrice;

  useEffect(() => {
    if (selectedDate) {
      loadAllSlots();
    }
  }, [selectedDate, service.id]);

  const loadAllSlots = async () => {
    const startOfDayDate = startOfDay(selectedDate!);
    const now = new Date();

    const { data, error } = await supabase
      .from('time_slots')
      .select('*')
      .gte('start_time', format(startOfDayDate, "yyyy-MM-dd'T'00:00:00"))
      .lt('start_time', format(addMinutes(startOfDayDate, 1440), "yyyy-MM-dd'T'00:00:00"))
      .eq('duration_minutes', duration);

    if (error) {
      console.error('Ошибка загрузки слотов:', error);
      return;
    }

    if (data) {
      const futureSlots = data.filter(slot => 
        !isBefore(new Date(slot.start_time), now)
      );
      setAllSlots(futureSlots);
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep(3); // Переход к подтверждению
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) return;
    
    setLoading(true);

    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const bookingDateTime = new Date(selectedDate);
      bookingDateTime.setHours(hours, minutes, 0, 0);

      // Создаём консультацию
      const { error: consultError } = await supabase
        .from('consultations')
        .insert([
          {
            user_id: user.id,
            service_id: service.id,
            scheduled_at: bookingDateTime.toISOString(),
            notes: notes,
            price: finalPrice, // Сохраняем итоговую цену
            bonus_used: useBonuses ? bonusAmount : 0, // Сохраняем сколько бонусов списали
            status: 'pending',
          }
        ]);

      if (consultError) throw consultError;

      // Находим слот и помечаем как забронированный
      const slot = allSlots.find(s => {
        const slotTime = format(new Date(s.start_time), 'HH:mm');
        return slotTime === selectedTime && !s.is_booked;
      });

      if (slot) {
        await supabase
          .from('time_slots')
          .update({ 
            is_booked: true,
            booked_by: user.id,
          })
          .eq('id', slot.id);
      }

      await loadAllSlots();

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onSuccess();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setLoading(false);
    }
  };

  const freeSlots = allSlots.filter(slot => !slot.is_booked);
  const bookedSlots = allSlots.filter(slot => slot.is_booked);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0b2e] to-[#2d1b4e] p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">📝 Запись на консультацию</h2>
        <button onClick={onCancel} className="text-purple-300">✕</button>
      </div>

      {/* Информация об услуге */}
      <div className="bg-white/10 p-4 rounded-xl mb-6 border border-white/10">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-white font-bold text-lg">{service.title}</h3>
          {/* Цена с учетом бонусов */}
          <div className="text-right">
            {useBonuses && bonusAmount > 0 ? (
              <div className="flex flex-col items-end">
                <span className="text-gray-400 line-through text-sm">{originalPrice} ₽</span>
                <span className="text-yellow-400 font-bold text-xl">{finalPrice} ₽</span>
              </div>
            ) : (
              <span className="text-yellow-400 font-bold text-xl">{originalPrice} ₽</span>
            )}
          </div>
        </div>
        <p className="text-purple-300 text-sm">Длительность: {duration} минут</p>
      </div>

      {/* Шаг 1: Выбор даты */}
      {step === 1 && (
        <div>
          <h3 className="text-white font-bold mb-4">Выберите дату:</h3>
          <div className="flex justify-center mb-4">
            <Calendar
              onChange={(value: any) => {
                if (value instanceof Date) {
                  setSelectedDate(value);
                  setStep(2);
                }
              }}
              value={selectedDate}
              minDate={new Date()}
              locale="ru-RU"
            />
          </div>
        </div>
      )}

      {/* Шаг 2: Выбор времени */}
      {step === 2 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">
              📅 {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: ru }) : ''}
            </h3>
            <button onClick={() => setStep(1)} className="text-purple-300 text-sm">← Назад</button>
          </div>

          {allSlots.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-purple-300">На эту дату нет доступных окон.<br/>Выберите другую дату.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {freeSlots.map((slot) => {
                const slotTime = format(new Date(slot.start_time), 'HH:mm');
                return (
                  <button
                    key={slot.id}
                    onClick={() => handleTimeSelect(slotTime)}
                    className="p-3 rounded-lg font-bold transition bg-purple-600 text-white hover:bg-purple-700"
                  >
                    {slotTime}
                  </button>
                );
              })}
              {bookedSlots.map((slot) => {
                const slotTime = format(new Date(slot.start_time), 'HH:mm');
                return (
                  <button
                    key={slot.id}
                    disabled
                    className="p-3 rounded-lg font-bold bg-gray-600 text-gray-400 cursor-not-allowed"
                  >
                    {slotTime}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Шаг 3: Подтверждение и Бонусы */}
      {step === 3 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">Подтверждение</h3>
            <button onClick={() => setStep(2)} className="text-purple-300 text-sm">← Назад</button>
          </div>

          <div className="bg-white/10 p-4 rounded-xl mb-4">
            <p className="text-white mb-2">📅 <span className="text-purple-300">Дата:</span> {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: ru }) : ''}</p>
            <p className="text-white mb-2">⏰ <span className="text-purple-300">Время:</span> {selectedTime}</p>
            
            {/* Блок с бонусами */}
            {userBalance > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-bold">💎 Использовать бонусы?</span>
                  <div 
                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition ${useBonuses ? 'bg-purple-600' : 'bg-gray-600'}`}
                    onClick={() => {
                      setUseBonuses(!useBonuses);
                      if (!useBonuses) setBonusAmount(0); // Сброс при выключении
                    }}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${useBonuses ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                </div>

                {useBonuses && (
                  <div className="bg-purple-900/30 p-3 rounded-lg border border-purple-500/30">
                    <p className="text-purple-200 text-sm mb-2">
                      Ваш баланс: <span className="text-yellow-400 font-bold">{userBalance} ₽</span>
                    </p>
                    <label className="text-purple-200 text-xs mb-1 block">Списать бонусов (макс. {maxBonusUsable}):</label>
                    <input
                      type="number"
                      min="0"
                      max={maxBonusUsable}
                      className="w-full p-2 bg-white/10 border border-purple-500/30 rounded-lg text-white text-lg font-bold focus:outline-none focus:border-purple-400"
                      value={bonusAmount}
                      onChange={(e) => {
                        let val = Number(e.target.value);
                        if (val > maxBonusUsable) val = maxBonusUsable;
                        if (val < 0) val = 0;
                        setBonusAmount(val);
                      }}
                    />
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-gray-400 line-through">Итого: {originalPrice} ₽</span>
                      <span className="text-green-400 font-bold">К оплате: {finalPrice} ₽</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Если бонусов 0 или выключены - просто показываем цену */}
            {userBalance === 0 && (
               <p className="text-yellow-400 font-bold mt-2">💰 Стоимость: {originalPrice} ₽</p>
            )}
          </div>

          <div className="mb-6">
            <label className="text-purple-200 text-sm mb-2 block">Комментарий (необязательно)</label>
            <textarea
              rows={3}
              className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
              placeholder="Расскажите кратко о вашем вопросе..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 bg-white/10 text-white p-4 rounded-lg font-bold hover:bg-white/20 transition">Назад</button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 text-white p-4 rounded-lg font-bold hover:from-purple-700 hover:to-purple-900 transition disabled:opacity-50"
            >
              {loading ? 'Отправка...' : 'Подтвердить запись'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};