import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ConsultationHistoryProps {
  user: any;
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

export const ConsultationHistory = ({ user, onBack }: ConsultationHistoryProps) => {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConsultations();
  }, []);

  const loadConsultations = async () => {
    const { data } = await supabase
      .from('consultations')
      .select(`
        *,
        services (title, price)
      `)
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: false });

    if (data) {
      setConsultations(data);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0b2e] to-[#2d1b4e] p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">📜 История консультаций</h2>
        <button onClick={onBack} className="text-purple-300">✕</button>
      </div>

      {loading ? (
        <p className="text-white text-center">Загрузка...</p>
      ) : consultations.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-purple-300">У вас пока нет консультаций</p>
        </div>
      ) : (
        <div className="space-y-3">
          {consultations.map((consultation) => (
            <div key={consultation.id} className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-white font-bold">
                  {consultation.services?.title || 'Услуга'}
                </h3>
                <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[consultation.status]}`}>
                  {statusLabels[consultation.status]}
                </span>
              </div>

              {consultation.scheduled_at && (
                <p className="text-purple-300 text-sm mb-2">
                  📅 {format(new Date(consultation.scheduled_at), 'dd MMMM yyyy HH:mm', { locale: ru })}
                </p>
              )}

              <div className="flex justify-between items-center mb-3">
                <span className="text-yellow-400 font-bold">{consultation.price} ₽</span>
                {consultation.bonus_used > 0 && (
                  <span className="text-purple-300 text-xs">
                    💎 Списано бонусов: {consultation.bonus_used} ₽
                  </span>
                )}
              </div>

              {/* Рекомендации администратора */}
              {consultation.admin_notes && consultation.status === 'completed' && (
                <div className="bg-blue-900/30 border border-blue-500/30 p-3 rounded-lg mb-2">
                  <p className="text-blue-300 text-xs font-bold mb-1">📝 Рекомендации:</p>
                  <p className="text-white text-sm">{consultation.admin_notes}</p>
                </div>
              )}

              <div className="text-gray-400 text-xs">
                {format(new Date(consultation.created_at), 'dd.MM.yyyy')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};