import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, addMinutes } from 'date-fns';
import { CalendarDays, Clock, CheckCircle2, XCircle, Plus } from 'lucide-react';

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
      alert(`✅ Создано ${slots.length} окон!`);
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="min-h-screen bg-[#F8F5F2] p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[#385144] flex items-center">
          <CalendarDays className="w-6 h-6 mr-2" />
          Управление окнами
        </h2>
        <button onClick={onBack} className="text-gray-500 hover:text-[#385144]">✕</button>
      </div>

      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
        <label className="text-[#385144] font-bold text-sm mb-3 block flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          Длительность консультации (минуты):
        </label>
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-[#385144] font-bold focus:outline-none focus:border-[#385144]"
        >
          <option value={40}>40 минут</option>
          <option value={60}>60 минут (1 час)</option>
          <option value={90}>90 минут (1.5 часа)</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
        <Calendar
          onChange={(value: any) => {
            if (value instanceof Date) {
              setSelectedDate(value);
            }
          }}
          value={selectedDate}
          locale="ru-RU"
          className="custom-calendar"
        />
      </div>

      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
        <div className="flex gap-2 mb-4">
          <button
            onClick={selectAllTimes}
            className="flex-1 bg-[#385144] text-white p-3 rounded-xl text-sm font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            Выбрать все
          </button>
          <button
            onClick={clearSelection}
            className="flex-1 bg-gray-200 text-gray-700 p-3 rounded-xl text-sm font-bold hover:bg-gray-300 transition"
          >
            Очистить
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-3 font-bold">
          Выбрано: <span className="text-[#385144]">{selectedTimes.length}</span> окон
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
                    ? 'bg-red-100 text-red-400 cursor-not-allowed'
                    : isSelected
                    ? 'bg-[#385144] text-white'
                    : isAlreadyInDb
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-[#F8F5F2] text-[#385144] hover:bg-gray-200'
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
          className="w-full bg-[#385144] text-white p-4 rounded-xl font-bold disabled:opacity-50 hover:bg-[#2d4238] transition flex items-center justify-center"
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          {loading ? 'Создание...' : `Создать ${selectedTimes.length || 'выбранные'} окна`}
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-[#385144] font-bold mb-3 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Существующие окна:
        </h3>
        <div className="space-y-2">
          {existingSlots.map((slot) => (
            <div 
              key={slot.id} 
              className={`p-3 rounded-xl flex justify-between items-center ${
                slot.is_booked ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
              }`}
            >
              <div>
                <p className="text-[#385144] font-bold">
                  {format(new Date(slot.start_time), 'HH:mm')} - {format(new Date(slot.end_time), 'HH:mm')}
                </p>
                <p className="text-gray-500 text-xs">{slot.duration_minutes} мин</p>
              </div>
              {slot.is_booked ? (
                <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
                  <XCircle className="w-3 h-3 mr-1" />
                  Занято
                </span>
              ) : (
                <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Свободно
                </span>
              )}
            </div>
          ))}
        </div>

        {existingSlots.length === 0 && (
          <p className="text-gray-500 text-center py-4">
            На этот день ещё нет окон. Выберите время выше и нажмите кнопку.
          </p>
        )}
      </div>
    </div>
  );
};