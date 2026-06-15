import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AdminSlotsManager } from './AdminSlotsManager';
import { AdminConsultationsManager } from './AdminConsultationsManager';

interface AdminDashboardProps {
  currentUser: any;
}

export const AdminDashboard = ({ currentUser }: AdminDashboardProps) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSlotsManager, setShowSlotsManager] = useState(false);
  const [showConsultationsManager, setShowConsultationsManager] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setUsers(data);
    setLoading(false);
  };

  if (showSlotsManager) {
    return <AdminSlotsManager admin={currentUser} onBack={() => setShowSlotsManager(false)} />;
  }

  if (showConsultationsManager) {
    return <AdminConsultationsManager admin={currentUser} onBack={() => setShowConsultationsManager(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">👑 Панель Администратора</h1>
        <div className="bg-purple-600 px-3 py-1 rounded-full text-sm">
          {currentUser.name}
        </div>
      </div>

      {/* Кнопки управления */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        <button
          onClick={() => setShowConsultationsManager(true)}
          className="w-full bg-gradient-to-r from-green-600 to-green-800 text-white p-4 rounded-xl font-bold hover:from-green-700 hover:to-green-900 transition flex items-center justify-between"
        >
          <span>📋 Управление записями</span>
          <span>→</span>
        </button>

        <button
          onClick={() => setShowSlotsManager(true)}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-xl font-bold hover:from-blue-700 hover:to-blue-900 transition flex items-center justify-between"
        >
          <span>📅 Управление окнами</span>
          <span>→</span>
        </button>
      </div>

      {/* Список пользователей */}
      {loading ? (
        <p className="text-white">Загрузка данных...</p>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Всего пользователей: {users.length}</p>
          
          {users.map((user) => (
            <div key={user.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-white font-bold">{user.name}</h3>
                  <p className="text-gray-400 text-xs">ID: {user.telegram_id}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'admin' ? 'bg-red-500' : 'bg-blue-500'}`}>
                  {user.role === 'admin' ? 'ADMIN' : 'КЛИЕНТ'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-gray-700 p-2 rounded">
                  <p className="text-xs text-gray-400">Статус</p>
                  <p className="text-white font-bold">{user.status}</p>
                </div>
                <div className="bg-gray-700 p-2 rounded">
                  <p className="text-xs text-gray-400">Баланс</p>
                  <p className="text-yellow-400 font-bold">{user.bonus_balance} ₽</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};