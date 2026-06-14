import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
}

interface DashboardProps {
  user: any;
}

export const Dashboard = ({ user }: DashboardProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Ошибка загрузки услуг:', error);
      } else {
        setServices(data || []);
      }
    } catch (err) {
      console.error('Ошибка:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    'Первое знакомство': 'from-gray-500 to-gray-600',
    'Basic': 'from-blue-500 to-blue-600',
    'Silver': 'from-gray-300 to-gray-400',
    'Gold': 'from-yellow-400 to-yellow-600',
    'Platinum': 'from-cyan-300 to-cyan-500',
    'Личное ведение': 'from-purple-500 to-pink-500',
  };

  const statusGradient = statusColors[user.status] || 'from-gray-500 to-gray-600';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0b2e] to-[#2d1b4e] p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className={`bg-gradient-to-r ${statusGradient} px-3 py-1.5 rounded-full shadow-lg`}>
          <span className="text-white text-xs font-bold">
            {user.status || 'Первое знакомство'}
          </span>
        </div>

        <div className="flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-full">
          <span className="text-yellow-400">✨</span>
          <span className="text-white font-bold text-sm">
            {user.bonus_balance || 0}
          </span>
        </div>
      </div>

      {/* Профиль */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {user.name?.charAt(0) || 'U'}
          </div>
          <div>
            <h2 className="text-white font-bold">{user.name || 'Пользователь'}</h2>
            <p className="text-purple-300 text-sm">{user.city || 'Город не указан'}</p>
          </div>
        </div>
      </div>

      {/* Основные действия */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        <button className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-4 rounded-xl font-bold text-left flex items-center justify-between hover:from-purple-700 hover:to-purple-900 transition">
          <span>📝 Записаться на консультацию</span>
          <span>→</span>
        </button>

        <button className="bg-white/10 text-white p-4 rounded-xl font-bold text-left flex items-center justify-between hover:bg-white/20 transition border border-white/10">
          <span>📜 История консультаций</span>
          <span>→</span>
        </button>

        <button className="bg-white/10 text-white p-4 rounded-xl font-bold text-left flex items-center justify-between hover:bg-white/20 transition border border-white/10">
          <span>🎁 Пригласить друга</span>
          <span>→</span>
        </button>
      </div>

      {/* Услуги */}
      <div>
        <h3 className="text-white font-bold mb-3 text-lg">Услуги</h3>
        
        {loading ? (
          <p className="text-purple-300 text-center py-4">Загрузка услуг...</p>
        ) : services.length === 0 ? (
          <p className="text-purple-300 text-center py-4">Услуги пока не добавлены</p>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div 
                key={service.id} 
                className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-bold">{service.title}</h4>
                  <span className="text-yellow-400 font-bold">{service.price} ₽</span>
                </div>
                {service.description && (
                  <p className="text-purple-300 text-sm">{service.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};