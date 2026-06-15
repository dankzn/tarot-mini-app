import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, addMinutes } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AdminSlotsManagerProps {
  admin: any;
  onBack: () => void;
}

export const AdminSlotsManager = ({ admin, onBack }: AdminSlotsManagerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [duration, setDuration] = useState(60);
  const [existingSlots, setExistingSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSlots();
  }, [selectedDate]);

  const loadSlots = async () => {
    const startOfDayDate = new Date(selectedDate);
    startOfDayDate.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('time_slots')
      .select('*')
      .gte('start_time', format(startOfDayDate, "yyyy-MM-dd'T'00:00:00"))
      .lt('start_time', format(addMinutes(startOfDayDate, 1440), "yyyy-MM-dd'T'00:00:00"))
      .order('start_time');

    if (data) setExistingSlots(data);
  };

  const createMultipleSlots = async () => {
    const startHour = 10;
    const endHour = 21;
    
    setLoading(true);

    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(selectedDate);
        slotStart.setHours(hour, minute, 0, 0);
        
        const slotEnd = addMinutes(slotStart, duration);

        slots.push({
          admin_id: admin.id,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          duration_minutes: duration,
          is_booked: false,
        });
      }
    }

    try {
      const { error } = await supabase
        .from('time_slots')
        .insert(slots);

      if (error) throw error;
      loadSlots();
      alert('Окна созданы!');
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">📅 Управление окнами</h2>
        <button onClick={onBack} className="text-purple-300">✕</button>
      </div>

      <div className="mb-6">
        <label className="text-purple-200 text-sm mb-2 block">Длительность консультации (минуты):</label>
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white"
        >
          <option value={40}>40 минут</option>
          <option value={60}>60 минут (1 час)</option>
          <option value={90}>90 минут (1.5 часа)</option>
        </select>
      </div>

      <div className="flex justify-center mb-6">
        <Calendar
          onChange={(value: any) => {
            if (value instanceof Date) {
              setSelectedDate(value);
            }
          }}
          value={selectedDate}
          locale="ru-RU"
          className="rounded-lg border-0 bg-white/5"
        />
      </div>

      <div className="mb-4">
        <button
          onClick={createMultipleSlots}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white p-4 rounded-lg font-bold mb-3 disabled:opacity-50"
        >
          {loading ? 'Создание...' : `Создать все окна на ${format(selectedDate, 'd MMMM', { locale: ru })}`}
        </button>
      </div>

      <h3 className="text-white font-bold mb-3">Существующие окна:</h3>
      <div className="space-y-2">
        {existingSlots.map((slot) => (
          <div 
            key={slot.id} 
            className={`p-3 rounded-lg flex justify-between items-center ${
              slot.is_booked ? 'bg-red-900/30 border border-red-500/30' : 'bg-green-900/30 border border-green-500/30'
            }`}
          >
            <div>
              <p className="text-white font-bold">
                {format(new Date(slot.start_time), 'HH:mm')} - {format(new Date(slot.end_time), 'HH:mm')}
              </p>
              <p className="text-gray-400 text-sm">{slot.duration_minutes} мин</p>
            </div>
            <span className={`px-3 py-1 rounded text-xs ${
              slot.is_booked ? 'bg-red-500' : 'bg-green-500'
            }`}>
              {slot.is_booked ? 'Забронировано' : 'Свободно'}
            </span>
          </div>
        ))}
      </div>

      {existingSlots.length === 0 && (
        <p className="text-gray-400 text-center py-4">
          На этот день ещё нет окон. Нажмите кнопку выше, чтобы создать.
        </p>
      )}
    </div>
  );
};