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
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);

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

  const toggleTimeSelection = (time: string) => {
    if (selectedTimes.includes(time)) {
      setSelectedTimes(selectedTimes.filter(t => t !== time));
    } else {
      setSelectedTimes([...selectedTimes, time]);
    }
  };

  const selectAllTimes = () => {
    const allTimes = [];
    for (let hour = 10; hour < 21; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        allTimes.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    setSelectedTimes(allTimes);
  };

  const clearSelection = () => {
    setSelectedTimes([]);
  };

  const createSelectedSlots = async () => {
    if (selectedTimes.length === 0) {
      alert('Выберите хотя бы одно время!');
      return;
    }

    setLoading(true);

    const slots = selectedTimes.map(time => {
      const [hours, minutes] = time.split(':').map(Number);
      const slotStart = new Date(selectedDate);
      slotStart.setHours(hours, minutes, 0, 0);
      
      const slotEnd = addMinutes(slotStart, duration);

      return {
        admin_id: admin.id,
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        duration_minutes: duration,
        is_booked: false,
      };
    });

    try {
      const { error } = await supabase
        .from('time_slots')
        .insert(slots);

      if (error) throw error;
      
      setSelectedTimes([]);
      loadSlots();
      alert(`Создано ${slots.length} окон!`);
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Генерируем все возможные временные слоты
  const allTimeSlots = [];
  for (let hour = 10; hour < 21; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const isBooked = existingSlots.some(slot => {
        const slotTime = format(new Date(slot.start_time), 'HH:mm');
        return slotTime === timeString && slot.is_booked;
      });
      
      allTimeSlots.push({ time: timeString, isBooked });
    }
  }

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
        <div className="flex gap-2 mb-3">
          <button
            onClick={selectAllTimes}
            className="flex-1 bg-blue-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition"
          >
            Выбрать все
          </button>
          <button
            onClick={clearSelection}
            className="flex-1 bg-gray-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-gray-700 transition"
          >
            Очистить
          </button>
        </div>

        <p className="text-purple-200 text-sm mb-3">
          Выбрано: {selectedTimes.length} окон
        </p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {allTimeSlots.map(({ time, isBooked }) => {
            const isSelected = selectedTimes.includes(time);
            const isAlreadyInDb = existingSlots.some(slot => {
              const slotTime = format(new Date(slot.start_time), 'HH:mm');
              return slotTime === time;
            });

            return (
              <button
                key={time}
                onClick={() => !isBooked && toggleTimeSelection(time)}
                disabled={isBooked}
                className={`p-3 rounded-lg font-bold transition ${
                  isBooked
                    ? 'bg-red-900/50 text-red-300 cursor-not-allowed'
                    : isSelected
                    ? 'bg-green-600 text-white'
                    : isAlreadyInDb
                    ? 'bg-yellow-600/50 text-yellow-200'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {time}
              </button>
            );
          })}
        </div>

        <button
          onClick={createSelectedSlots}
          disabled={loading || selectedTimes.length === 0}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white p-4 rounded-lg font-bold disabled:opacity-50"
        >
          {loading ? 'Создание...' : `Создать ${selectedTimes.length || 'выбранные'} окна на ${format(selectedDate, 'd MMMM', { locale: ru })}`}
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
          На этот день ещё нет окон. Выберите время выше и нажмите кнопку.
        </p>
      )}
    </div>
  );
};