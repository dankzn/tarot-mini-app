import { ClientsManager } from '../components/admin/ClientsManager';

export const AdminWebClients = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <a href="/admin-web/dashboard" className="text-[#385144] hover:underline">
            ← Назад к dashboard
          </a>
        </div>
        <ClientsManager />
      </div>
    </div>
  );
};