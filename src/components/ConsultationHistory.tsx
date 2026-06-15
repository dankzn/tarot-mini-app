import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ScrollText, Clock, DollarSign, Calendar, Sparkles, FileText } from 'lucide-react';

interface ConsultationHistoryProps {
  user: any;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
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
    <div className="min-h-screen bg-[#F8F5F2] p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[#385144] flex items-center">
          <ScrollText className="w-6 h-6 mr-2" />
          История консультаций
        </h2>
        <button onClick={onBack} className="text-gray-500 hover:text-[#385144]">✕</button>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <p className="text-gray-500">Загрузка...</p>
        </div>
      ) : consultations.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-500">У вас пока нет консультаций</p>
        </div>
      ) : (
        <div className="space-y-4">
          {consultations.map((consultation) => (
            <div key={consultation.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-[#385144] font-bold text-lg flex-1">
                  {consultation.services?.title || 'Консультация'}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[consultation.status]}`}>
                  {statusLabels[consultation.status]}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-gray-600 text-sm">
                  <Calendar className="w-4 h-4 mr-2 text-[#6B4EE6]" />
                  {consultation.scheduled_at 
                    ? format(new Date(consultation.scheduled_at), 'dd MMMM yyyy', { locale: ru })
                    : 'Дата не указана'
                  }
                </div>
                <div className="flex items-center text-gray-600 text-sm">
                  <Clock className="w-4 h-4 mr-2 text-[#6B4EE6]" />
                  {consultation.scheduled_at 
                    ? format(new Date(consultation.scheduled_at), 'HH:mm')
                    : ''
                  }
                </div>
                <div className="flex items-center text-gray-600 text-sm">
                  <DollarSign className="w-4 h-4 mr-2 text-[#6B4EE6]" />
                  <span className="font-bold text-[#385144]">{consultation.price} ₽</span>
                  {consultation.bonus_used > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      (списано бонусов: {consultation.bonus_used} ₽)
                    </span>
                  )}
                </div>
              </div>

              {consultation.admin_notes && consultation.status === 'completed' && (
                <div className="bg-[#F8F5F2] border-l-4 border-[#6B4EE6] p-4 rounded-r-xl mb-3">
                  <div className="flex items-start">
                    <FileText className="w-5 h-5 mr-2 text-[#6B4EE6] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[#385144] text-xs font-bold mb-1">Рекомендации:</p>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{consultation.admin_notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {consultation.notes && (
                <div className="bg-gray-50 border-l-4 border-gray-300 p-4 rounded-r-xl">
                  <p className="text-gray-500 text-xs mb-1">Ваш комментарий:</p>
                  <p className="text-gray-600 text-sm">{consultation.notes}</p>
                </div>
              )}

              {consultation.bonus_paid > 0 && (
                <div className="mt-3 flex items-center text-sm">
                  <Sparkles className="w-4 h-4 mr-1 text-[#D4AF37]" />
                  <span className="text-gray-600">Начислено бонусов:</span>
                  <span className="text-[#D4AF37] font-bold ml-1">+{consultation.bonus_paid} ₽</span>
                </div>
              )}

              <div className="text-gray-400 text-xs mt-3 pt-3 border-t border-gray-100">
                Создано: {format(new Date(consultation.created_at), 'dd.MM.yyyy HH:mm')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};