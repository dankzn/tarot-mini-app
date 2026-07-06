import { AdminBackButton } from '../components/admin/AdminBackButton';
import { TrainingManager } from '../components/admin/TrainingManager';

export const AdminWebTraining = () => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F5F2_42%,#EFE6DA_100%)] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <AdminBackButton href="/admin-web/dashboard" label="В dashboard" />
            <h1 className="mt-4 text-4xl font-black text-[#385144]">Обучение Таро</h1>
            <p className="mt-2 max-w-2xl text-gray-600">
              Программы, группы, заявки учеников и статусы оплаты в одном месте.
            </p>
          </div>
          <div className="hidden rounded-3xl bg-white/70 px-5 py-4 text-right shadow-sm md:block">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A5A3F]/70">tarot academy</p>
            <p className="mt-1 font-black text-[#385144]">Admin Space</p>
          </div>
        </div>
        <TrainingManager />
      </div>
    </div>
  );
};
