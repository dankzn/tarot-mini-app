import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BookingForm } from './BookingForm';
import { ConsultationHistory } from './ConsultationHistory';
import { 
  Crown, 
  Sparkles, 
  ScrollText, 
  Gift, 
  CalendarCheck,
  User,
  MapPin,
  Clock,
  DollarSign
} from 'lucide-react';

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration_minutes?: number;
}

interface DashboardProps {
  user: any;
}

export const Dashboard = ({ user }: DashboardProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('price', { ascending: true });

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
    'Первое знакомство': 'bg-gray-200 text-gray-700',
    'Basic': 'bg-blue-100 text-blue-700',
    'Silver': 'bg-gray-100 text-gray-600',
    'Gold': 'bg-yellow-100 text-yellow-700',
    'Platinum': 'bg-purple-100 text-purple-700',
    'Личное ведение': 'bg-[#6B4EE6]/10 text-[#6B4EE6]',
  };

  const currentStatus = user.status || 'Первое знакомство';
  const statusColor = statusColors[currentStatus] || statusColors['Первое знакомство'];

  // Показываем форму записи
  if (showBooking && selectedService) {
    return (
      <BookingForm 
        user={user}
        service={selectedService}
        onSuccess={() => {
          setShowBooking(false);
          setSelectedService(null);
          alert('✅ Заявка отправлена! Я свяжусь с вами для подтверждения.');
        }}
        onCancel={() => {
          setShowBooking(false);
          setSelectedService(null);
        }}
      />
    );
  }

  // Показываем историю консультаций
  if (showHistory) {
    return <ConsultationHistory user={user} onBack={() => setShowHistory(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2] p-4 pb-20">
      {/* Шапка профиля */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-14 h-14 bg-gradient-to-br from-[#385144] to-[#6B4EE6] rounded-full flex items-center justify-center text-white font-bold text-xl">
              {user.name?.charAt(0) || 'U'}
            </div>
            <div>
              <h2 className="text-[#385144] font-bold text-lg">{user.name || 'Пользователь'}</h2>
              <div className="flex items-center text-gray-500 text-sm">
                <MapPin className="w-3 h-3 mr-1" />
                {user.city || 'Город не указан'}
              </div>
            </div>
          </div>
        </div>

        {/* Статус и бонусы */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#F8F5F2] rounded-xl p-3 border border-gray-100">
            <div className="flex items-center mb-1">
              <Crown className="w-4 h-4 mr-1 text-[#D4AF37]" />
              <span className="text-gray-500 text-xs">Статус</span>
            </div>
            <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${statusColor}`}>
              {currentStatus}
            </span>
          </div>

          <div className="bg-[#F8F5F2] rounded-xl p-3 border border-gray-100">
            <div className="flex items-center mb-1">
              <Sparkles className="w-4 h-4 mr-1 text-[#D4AF37]" />
              <span className="text-gray-500 text-xs">Бонусы</span>
            </div>
            <span className="text-[#D4AF37] font-bold text-lg">
              {user.bonus_balance || 0} ₽
            </span>
          </div>
        </div>
      </div>

      {/* Основные действия */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        <button 
          onClick={() => setShowHistory(true)}
          className="bg-white text-[#385144] p-4 rounded-xl font-bold text-left flex items-center justify-between hover:bg-gray-50 transition border border-gray-100 shadow-sm"
        >
          <div className="flex items-center">
            <ScrollText className="w-5 h-5 mr-3 text-[#6B4EE6]" />
            <span>История консультаций</span>
          </div>
          <span className="text-gray-400">→</span>
        </button>

        <button className="bg-white text-[#385144] p-4 rounded-xl font-bold text-left flex items-center justify-between hover:bg-gray-50 transition border border-gray-100 shadow-sm">
          <div className="flex items-center">
            <Gift className="w-5 h-5 mr-3 text-[#6B4EE6]" />
            <span>Пригласить друга</span>
          </div>
          <span className="text-gray-400">→</span>
        </button>
      </div>

      {/* Услуги */}
      <div>
        <h3 className="text-[#385144] font-bold mb-3 text-lg flex items-center">
          <CalendarCheck className="w-5 h-5 mr-2" />
          Услуги
        </h3>
        
        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <p className="text-gray-500">Загрузка услуг...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <p className="text-gray-500">Услуги пока не добавлены</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div 
                key={service.id} 
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-[#385144] font-bold text-lg flex-1 pr-2">
                    {service.title}
                  </h4>
                  <div className="flex items-center text-[#D4AF37] font-bold text-xl">
                    <DollarSign className="w-5 h-5" />
                    <span>{service.price}</span>
                  </div>
                </div>

                {service.description && (
                  <p className="text-gray-600 text-sm mb-3">{service.description}</p>
                )}

                {service.duration_minutes && (
                  <div className="flex items-center text-gray-500 text-xs mb-3">
                    <Clock className="w-3 h-3 mr-1" />
                    {service.duration_minutes} минут
                  </div>
                )}

                <button
                  onClick={() => {
                    setSelectedService(service);
                    setShowBooking(true);
                  }}
                  className="w-full bg-[#385144] text-white py-3 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
                >
                  <CalendarCheck className="w-4 h-4 mr-2" />
                  Записаться
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};