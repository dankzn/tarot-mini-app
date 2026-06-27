import { ServicesManager } from '../components/admin/ServicesManager';

export const AdminWebServices = () => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F5F2_42%,#EFE6DA_100%)] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <a href="/admin-web/dashboard" className="text-[#385144] hover:underline">
            ← Назад к dashboard
            </a>
            <h1 className="mt-4 text-4xl font-black text-[#385144]">Услуги и кампании</h1>
            <p className="mt-2 max-w-2xl text-gray-600">
              Управление витриной, акциями, таймерами и плановым повышением цен в одном месте.
            </p>
          </div>
          <div className="hidden rounded-3xl bg-white/70 px-5 py-4 text-right shadow-sm md:block">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A5A3F]/70">admin space</p>
            <p className="mt-1 font-black text-[#385144]">Tarot by Danil</p>
          </div>
        </div>
        <ServicesManager />
      </div>
    </div>
  );
};
