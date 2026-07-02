import { ClientsManager } from '../components/admin/ClientsManager';
import { AdminBackButton } from '../components/admin/AdminBackButton';

export const AdminWebClients = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <AdminBackButton href="/admin-web/dashboard" label="В dashboard" />
        </div>
        <ClientsManager />
      </div>
    </div>
  );
};
