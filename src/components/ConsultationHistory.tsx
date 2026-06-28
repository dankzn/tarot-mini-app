import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ScrollText, Clock, DollarSign, Sparkles, FileText, ChevronLeft, CalendarCheck } from 'lucide-react';

interface ConsultationHistoryProps {
  user: any;
  onBack: () => void;
  onRebook?: (service: any) => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-[#F4E7C8] text-[#7A5A21] border-[#E5CF91]',
  confirmed: 'bg-[#DDE9E0] text-[#385144] border-[#C7D8CB]',
  in_progress: 'bg-[#E7D8C9] text-[#8A5A3F] border-[#D8C0AC]',
  completed: 'bg-[#EAF1EA] text-[#385144] border-[#C7D8CB]',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const statusLabels: Record<string, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  in_progress: 'В процессе',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

const statusSteps = ['pending', 'confirmed', 'in_progress', 'completed'];

export const ConsultationHistory = ({ user, onBack, onRebook }: ConsultationHistoryProps) => {
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
        services (*)
      `)
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: false });

    if (data) {
      setConsultations(data);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_42%,#EFE6DA_100%)] p-4 text-[#2F463B]">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-[0_12px_30px_rgba(56,81,68,0.10)]"
          >
            <ChevronLeft className="h-5 w-5 text-[#385144]" />
          </button>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">
              consultation timeline
            </p>
            <h2 className="text-2xl font-black text-[#385144]">История</h2>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-[0_16px_40px_rgba(56,81,68,0.10)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#6C756C]">Всего записей</p>
              <p className="text-3xl font-black text-[#385144]">{consultations.length}</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#385144] text-white">
              <ScrollText className="h-6 w-6" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[1.75rem] border border-white/80 bg-white/80 p-8 text-center shadow-sm">
            <p className="text-[#6C756C]">Загрузка...</p>
          </div>
        ) : consultations.length === 0 ? (
          <div className="rounded-[1.75rem] border border-white/80 bg-white/80 p-8 text-center shadow-sm">
            <div className="mb-4 text-5xl">📭</div>
            <p className="font-black text-[#385144]">Пока нет консультаций</p>
            <p className="mt-2 text-sm leading-relaxed text-[#6C756C]">
              После записи здесь появится спокойная история встреч, статусов и рекомендаций.
            </p>
          </div>
        ) : (
          <div className="relative space-y-4 pl-4">
            <div className="absolute left-[1.05rem] top-2 h-[calc(100%-1rem)] w-px bg-[#D8CFC4]" />
            {consultations.map((consultation, index) => (
              <div key={consultation.id} className="relative pl-6">
                <span className={`absolute left-0 top-6 h-3 w-3 rounded-full border-2 border-white ${
                  index === 0 ? 'bg-[#B8795C]' : 'bg-[#385144]'
                } shadow-sm`} />
                <div className="rounded-[1.6rem] border border-white/80 bg-white/85 p-5 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8A5A3F]/65">
                        {consultation.scheduled_at
                          ? format(new Date(consultation.scheduled_at), 'd MMMM yyyy', { locale: ru })
                          : 'Дата не указана'}
                      </p>
                      <h3 className="text-lg font-black leading-tight text-[#385144]">
                        {consultation.services?.title || 'Консультация'}
                      </h3>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-black ${
                      statusColors[consultation.status] || 'bg-[#EAF1EA] text-[#385144] border-[#C7D8CB]'
                    }`}>
                      {statusLabels[consultation.status] || consultation.status}
                    </span>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-[#F8F3EC] p-3">
                      <div className="mb-1 flex items-center text-xs font-bold text-[#8A5A3F]">
                        <Clock className="mr-1 h-3.5 w-3.5" />
                        Время
                      </div>
                      <p className="font-black text-[#385144]">
                        {consultation.scheduled_at ? format(new Date(consultation.scheduled_at), 'HH:mm') : '—'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#F8F3EC] p-3">
                      <div className="mb-1 flex items-center text-xs font-bold text-[#8A5A3F]">
                        <DollarSign className="mr-1 h-3.5 w-3.5" />
                        Стоимость
                      </div>
                      <p className="font-black text-[#385144]">{consultation.price} ₽</p>
                    </div>
                  </div>

                  <div className="mb-4 rounded-[1.25rem] bg-[#F8F3EC] p-3">
                    <div className="grid grid-cols-4 gap-2">
                      {statusSteps.map((status, stepIndex) => {
                        const currentIndex = statusSteps.indexOf(consultation.status);
                        const isDone = currentIndex >= stepIndex;

                        return (
                          <div key={status} className="text-center">
                            <div className={`mx-auto mb-1 h-2 rounded-full ${
                              isDone ? 'bg-[#385144]' : 'bg-[#D8CFC4]'
                            }`} />
                            <p className={`text-[10px] font-black leading-tight ${
                              isDone ? 'text-[#385144]' : 'text-[#8FA092]'
                            }`}>
                              {status === 'pending' ? 'Заявка' :
                                status === 'confirmed' ? 'Подтверждение' :
                                status === 'in_progress' ? 'Встреча' : 'Итоги'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {consultation.bonus_used > 0 && (
                    <p className="mb-3 rounded-2xl bg-[#EAF1EA] px-3 py-2 text-xs font-bold text-[#385144]">
                      Списано бонусов: {consultation.bonus_used} ₽
                    </p>
                  )}

                  {consultation.admin_notes && consultation.status === 'completed' && (
                    <div className="mb-3 rounded-[1.25rem] border border-[#B8795C]/20 bg-[#FFF6EF] p-4">
                      <div className="mb-2 flex items-center text-xs font-black uppercase tracking-[0.14em] text-[#8A5A3F]">
                        <FileText className="mr-2 h-4 w-4" />
                        Рекомендации
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#59645C]">{consultation.admin_notes}</p>
                    </div>
                  )}

                  {consultation.notes && (
                    <div className="rounded-[1.25rem] bg-[#F8F3EC] p-4">
                      <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-[#8FA092]">Ваш комментарий</p>
                      <p className="text-sm leading-relaxed text-[#59645C]">{consultation.notes}</p>
                    </div>
                  )}

                  {consultation.bonus_paid > 0 && (
                    <div className="mt-3 flex items-center text-sm">
                      <Sparkles className="mr-1 h-4 w-4 text-[#B8795C]" />
                      <span className="text-[#6C756C]">Начислено бонусов:</span>
                      <span className="ml-1 font-black text-[#8A5A3F]">+{consultation.bonus_paid} ₽</span>
                    </div>
                  )}

                  {consultation.services && onRebook && (
                    <button
                      onClick={() => onRebook(consultation.services)}
                      className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#385144] px-4 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(56,81,68,0.18)]"
                    >
                      <CalendarCheck className="mr-2 h-4 w-4" />
                      Записаться снова
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
