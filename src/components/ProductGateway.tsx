import { BookOpen, CalendarCheck, ChevronRight, Sparkles } from 'lucide-react';

interface ProductGatewayProps {
  user: any;
  onChooseConsultations: () => void;
  onChooseTraining: () => void;
}

export const ProductGateway = ({ user, onChooseConsultations, onChooseTraining }: ProductGatewayProps) => {
  const firstName = String(user?.name || '').split(' ')[0] || 'привет';

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_10%,#E7EFE7_0,transparent_30%),radial-gradient(circle_at_82%_22%,#F2DFD1_0,transparent_28%),linear-gradient(145deg,#F8F3EC_0%,#EFE6DA_100%)] px-6 py-8 text-[#2F463B]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white/78 shadow-[0_18px_48px_rgba(56,81,68,0.13)]">
            <img src="/logo.png" alt="Tarot by Danil" className="h-16 w-16 object-contain" />
          </div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-[#B8795C]">personal tarot space</p>
          <h1 className="text-4xl font-black leading-none text-[#385144]">Куда идём?</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm font-semibold leading-relaxed text-[#657066]">
            {firstName}, выберите пространство: личная консультация или обучение Таро.
          </p>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={onChooseConsultations}
            className="group w-full overflow-hidden rounded-[2rem] border border-white/80 bg-white/82 p-5 text-left shadow-[0_18px_42px_rgba(56,81,68,0.10)] backdrop-blur transition active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#385144] text-white shadow-[0_14px_32px_rgba(56,81,68,0.18)]">
                <CalendarCheck className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#B8795C]">consultation</p>
                <h2 className="text-2xl font-black text-[#385144]">Записаться на консультацию</h2>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-[#667067]">
                  Выбрать формат, время, оплату, бонусы и личный кабинет клиента.
                </p>
              </div>
              <ChevronRight className="mt-4 h-6 w-6 text-[#9AA39B] transition group-hover:translate-x-1" />
            </div>
          </button>

          <button
            type="button"
            onClick={onChooseTraining}
            className="group w-full overflow-hidden rounded-[2rem] bg-[#385144] p-5 text-left text-white shadow-[0_22px_50px_rgba(56,81,68,0.22)] transition active:scale-[0.99]"
          >
            <div className="absolute inset-0 opacity-20" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/16 text-[#F4E7C8] ring-1 ring-white/20">
                <BookOpen className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#F4E7C8]">tarot academy</p>
                <h2 className="text-2xl font-black leading-tight">Записаться на обучение</h2>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-white/76">
                  Индивидуальные и групповые программы: база, практика и уверенный старт.
                </p>
              </div>
              <Sparkles className="mt-4 h-6 w-6 text-[#F4E7C8] transition group-hover:rotate-12" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
