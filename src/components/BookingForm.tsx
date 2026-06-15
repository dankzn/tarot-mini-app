import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './CalendarStyles.css';
import { format, addMinutes, isBefore, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';

interface BookingFormProps {
  user: any;
  service: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const BookingForm = ({ user, service, onSuccess, onCancel }: BookingFormProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState(1);

  const duration = service.duration_minutes || 60;

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate, service.id]);

  const loadAvailableSlots = async () => {
    const startOfDayDate = startOfDay(selectedDate!);
    const now = new Date();

    const { data } = await supabase
      .from('time_slots')
      .select('*')
      .gte('start_time', format(startOfDayDate, "yyyy-MM-dd'T'00:00:00"))
      .lt('start_time', format(addMinutes(startOfDayDate, 1440), "yyyy-MM-dd'T'00:00:00"))
      .eq('is_booked', false)
      .eq('duration_minutes', duration);

    if (data) {
      const futureSlots = data.filter(slot => 
        !isBefore(new Date(slot.start_time), now)
      );
      setAvailableSlots(futureSlots);
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    const startHour = 10;
    const endHour = 21;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) return;
    
    setLoading(true);

    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const bookingDateTime = new Date(selectedDate);
      bookingDateTime.setHours(hours, minutes, 0, 0);

      const endTime = addMinutes(bookingDateTime, duration);

      const { data: consultation } = await supabase
        .from('consultations')
        .insert([
          {
            user_id: user.id,
            service_id: service.id,
            scheduled_at: bookingDateTime.toISOString(),
            notes: notes,
            price: service.price,
            status: 'pending',
          }
        ])
        .select()
        .single();

      await supabase
        .from('time_slots')
        .insert([
          {
            start_time: bookingDateTime.toISOString(),
            end_time: endTime.toISOString(),
            duration_minutes: duration,
            is_booked: true,
            booked_by: user.id,
            consultation_id: consultation.id,
          }
        ]);

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onSuccess();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setLoading(false);
    }
  };

  const timeSlots = generateTimeSlots();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0b2e] to-[#2d1b4e] p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">📝 Запись на консультацию</h2>
        <button onClick={onCancel} className="text-purple-300">✕</button>
      </div>

      <div className="bg-white/10 p-4 rounded-xl mb-6 border border-white/10">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-white font-bold text-lg">{service.title}</h3>
          <span className="text-yellow-400 font-bold text-xl">{service.price} ₽</span>
        </div>
        <p className="text-purple-300 text-sm">
          Длительность: {duration} минут
        </p>
        {service.description && (
          <p className="text-purple-300 text-sm mt-2">{service.description}</p>
        )}
      </div>

      {step === 1 && (
        <div>
          <h3 className="text-white font-bold mb-4">Выберите дату:</h3>
          <div className="flex justify-center mb-4">
            <Calendar
  onChange={(value) => {
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

      {step === 2 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">
              📅 {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: ru }) : ''}
            </h3>
            <button 
              onClick={() => setStep(1)}
              className="text-purple-300 text-sm"
            >
              ← Назад
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {timeSlots.map((time) => {
              const isBooked = availableSlots.some(slot => {
                const slotTime = format(new Date(slot.start_time), 'HH:mm');
                return slotTime === time;
              });

              return (
                <button
                  key={time}
                  onClick={() => handleTimeSelect(time)}
                  disabled={isBooked}
                  className={`p-3 rounded-lg font-bold transition ${
                    isBooked
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>

          {availableSlots.length === 0 && (
            <p className="text-purple-300 text-center py-4">
              На эту дату нет доступных окон. Выберите другую дату.
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">Подтверждение</h3>
            <button 
              onClick={() => setStep(2)}
              className="text-purple-300 text-sm"
            >
              ← Назад
            </button>
          </div>

          <div className="bg-white/10 p-4 rounded-xl mb-4">
            <p className="text-white mb-2">
              📅 <span className="text-purple-300">Дата:</span> {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: ru }) : ''}
            </p>
            <p className="text-white mb-2">
              ⏰ <span className="text-purple-300">Время:</span> {selectedTime}
            </p>
            <p className="text-white mb-2">
              ⏱ <span className="text-purple-300">Длительность:</span> {duration} мин
            </p>
            <p className="text-white">
              💰 <span className="text-purple-300">Стоимость:</span> {service.price} ₽
            </p>
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
            <button
              onClick={() => setStep(2)}
              className="flex-1 bg-white/10 text-white p-4 rounded-lg font-bold hover:bg-white/20 transition"
            >
              Назад
            </button>
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