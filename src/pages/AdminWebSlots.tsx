import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format, addMinutes, parse } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  Plus, 
  Trash2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

export const AdminWebSlots = () => {
  const navigate = useNavigate();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
    loadSlots();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/admin-web');
    }
  };

  const loadSlots = async () => {
    try {
      const { data } = await supabase
        .from('time_slots')
        .select('*')
        .order('start_time', { ascending: true });

      setSlots(data || []);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlots = () => {
    if (!selectedDate || !startTime || !endTime) {
      setError('Заполните все поля');
      return;
    }

    setError('');
    const start = parse(`${selectedDate} ${startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const end = parse(`${selectedDate} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date());

    if (start >= end) {
      setError('Время начала должно быть раньше времени окончания');
      return;
    }

    const newSlots = [];
    let current = start;

    while (current < end) {
      newSlots.push({
        start_time: format(current, "yyyy-MM-dd'T'HH:mm:ss"),
        duration_minutes: duration,
        is_booked: false,
      });
      current = addMinutes(current, duration);
    }

    return newSlots;
  };

  const handleCreate = async () => {
    const newSlots = generateSlots();
    if (!newSlots || newSlots.length === 0) return;

    try {
      const { error } = await supabase
        .from('time_slots')
        .insert(newSlots);

      if (error) throw error;

      alert(`✅ Создано ${newSlots.length} слотов!`);
      setShowCreateForm(false);
      setSelectedDate('');
      setStartTime('');
      setEndTime('');
      await loadSlots();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const handleDelete = async (slotId: string) => {
    if (!confirm('Удалить этот слот?')) return;

    try {
      const { error } = await supabase
        .from('time_slots')
        .delete()
        .eq('id', slotId);

      if (error) throw error;
      await loadSlots();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const groupedSlots = slots.reduce((acc: any, slot: any) => {
    const date = format(new Date(slot.start_time), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {});

  if (showCreateForm) {
    return (
      <div className="min-h-screen bg-[#F8F5F2]">
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <button onClick={() => setShowCreateForm(false)} className="flex items-center text-gray-600 hover:text-[#385144]">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Назад
            </button>
            <h1 className="text-2xl font-bold text-[#385144]">Создание слотов</h1>
            <div></div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-[#385144] font-bold text-lg mb-4 flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              Параметры слотов
            </h3>

            {error && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Дата
                </label>
                <input
                  type="date"
                  className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Время начала
                  </label>
                  <input
                    type="time"
                    className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Время окончания
                  </label>
                  <input
                    type="time"
                    className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[#385144] font-bold text-sm mb-2 block">
                  Длительность (минуты)
                </label>
                <select
                  className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  <option value={30}>30 минут</option>
                  <option value={60}>60 минут</option>
                  <option value={90}>90 минут</option>
                  <option value={120}>120 минут</option>
                </select>
              </div>

              {selectedDate && startTime && endTime && (
                <div className="bg-[#F8F5F2] p-4 rounded-xl border border-[#385144]/20">
                  <p className="text-[#385144] font-bold mb-2">Будет создано слотов:</p>
                  <p className="text-3xl font-bold text-[#385144]">
                    {generateSlots()?.length || 0}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 p-4 rounded-xl font-bold hover:bg-gray-300 transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 bg-[#385144] text-white p-4 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Создать слоты
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2]">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/admin-web/dashboard')} className="flex items-center text-gray-600 hover:text-[#385144]">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Назад
          </button>
          <h1 className="text-2xl font-bold text-[#385144]">Управление окнами</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-[#385144] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Создать
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500">Загрузка...</p>
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Слоты не созданы</p>
            <p className="text-gray-400 text-sm mt-1">Нажмите "Создать" чтобы добавить окна</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSlots).map(([date, dateSlots]: [string, any]) => (
              <div key={date} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-[#385144] font-bold text-lg mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  {format(new Date(date), 'd MMMM yyyy', { locale: ru })}
                  <span className="ml-2 text-gray-500 text-sm font-normal">
                    ({dateSlots.length} слотов)
                  </span>
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {dateSlots.map((slot: any) => (
                    <div
                      key={slot.id}
                      className={`p-3 rounded-xl border-2 ${
                        slot.is_booked
                          ? 'bg-gray-100 border-gray-300'
                          : 'bg-[#F8F5F2] border-[#385144]/20'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className={`font-bold text-sm ${
                          slot.is_booked ? 'text-gray-500' : 'text-[#385144]'
                        }`}>
                          {format(new Date(slot.start_time), 'HH:mm')}
                        </span>
                        <button
                          onClick={() => handleDelete(slot.id)}
                          className="text-gray-400 hover:text-red-500 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center text-xs">
                        <Clock className="w-3 h-3 mr-1 text-gray-400" />
                        <span className="text-gray-500">{slot.duration_minutes} мин</span>
                      </div>
                      {slot.is_booked && (
                        <div className="mt-2 text-xs text-gray-500 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Забронировано
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};