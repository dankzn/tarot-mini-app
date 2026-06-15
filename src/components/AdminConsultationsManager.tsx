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

export const AdminConsultationsManager = ({ onBack }: AdminConsultationsManagerProps) => {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadConsultations();
  }, []);

  const loadConsultations = async () => {
    const { data, error } = await supabase
      .from('consultations')
      .select(`
        *,
        users (name, telegram_id, phone, city),
        services (title, price)
      `)
      .order('scheduled_at', { ascending: false });

    if (error) {
      console.error('Ошибка загрузки записей:', error);
    } else {
      setConsultations(data || []);
    }
    setLoading(false);
  };

  const updateConsultationStatus = async (consultationId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('consultations')
        .update({ status: newStatus })
        .eq('id', consultationId);

      if (error) throw error;
      
      // Обновляем локально
      setConsultations(consultations.map(c => 
        c.id === consultationId ? { ...c, status: newStatus } : c
      ));
      
      alert('Статус обновлён!');
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const filteredConsultations = filter === 'all' 
    ? consultations 
    : consultations.filter(c => c.status === filter);

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
                {/* Шапка: клиент и статус */}
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

                {/* Информация об услуге */}
                <div className="bg-gray-700/50 p-3 rounded-lg mb-3">
                  <p className="text-white font-bold">{service?.title || 'Услуга удалена'}</p>
                  <div className="flex gap-4 mt-2 text-sm">
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

                {/* Комментарий клиента */}
                {consultation.notes && (
                  <div className="bg-white/5 p-3 rounded-lg mb-3">
                    <p className="text-gray-400 text-xs mb-1">💬 Комментарий клиента:</p>
                    <p className="text-white text-sm">{consultation.notes}</p>
                  </div>
                )}

                {/* Админские заметки */}
                {consultation.admin_notes && (
                  <div className="bg-blue-900/30 p-3 rounded-lg mb-3">
                    <p className="text-blue-300 text-xs mb-1">📝 Ваши заметки:</p>
                    <p className="text-white text-sm">{consultation.admin_notes}</p>
                  </div>
                )}

                {/* Кнопки управления статусом */}
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
                      onClick={() => updateConsultationStatus(consultation.id, 'completed')}
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