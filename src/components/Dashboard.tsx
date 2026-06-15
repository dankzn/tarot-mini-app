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
  MapPin,
  Clock,
  X,
  Info,
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
  const [showStatusInfo, setShowStatusInfo] = useState(false);
  const [showBonusInfo, setShowBonusInfo] = useState(false);
  const [bonusHistory, setBonusHistory] = useState<any[]>([]);

  useEffect(() => {
    loadServices();
    loadBonusHistory();
  }, []);

  // Принудительная перезагрузка данных при монтировании
useEffect(() => {
  const reloadUserData = async () => {
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (userData) {
      // Обновляем user объект с новыми данными
      window.location.href = window.location.href;
    }
  };
  
  reloadUserData();
}, []);

  const loadServices = async () => {
    try {
      const { data } = await supabase
        .from('services')
        .select('*')
        .order('price', { ascending: true });

      if (data) {
        setServices(data);
      }
    } catch (err) {
      console.error('Ошибка:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBonusHistory = async () => {
    const { data } = await supabase
      .from('consultations')
      .select('id, created_at, bonus_paid, bonus_used, price, services(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setBonusHistory(data);
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

  const statusInfo = [
    { name: 'Первое знакомство', desc: 'Начальный уровень', count: '0 консультаций' },
    { name: 'Basic', desc: 'Базовый уровень', count: '1-2 консультации' },
    { name: 'Silver', desc: 'Средний уровень', count: '3-5 консультаций' },
    { name: 'Gold', desc: 'Продвинутый уровень', count: '6-10 консультаций' },
    { name: 'Platinum', desc: 'Высокий уровень', count: '11-20 консультаций' },
    { name: 'Личное ведение', desc: 'VIP уровень', count: '21+ консультаций' },
  ];

  const currentStatus = user.status || 'Первое знакомство';
  const statusColor = statusColors[currentStatus] || statusColors['Первое знакомство'];

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

  if (showHistory) {
    return <ConsultationHistory user={user} onBack={() => setShowHistory(false)} />;
  }

  // Модальное окно информации о статусах
  if (showStatusInfo) {
    return (
      <div className="min-h-screen bg-[#F8F5F2] p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#385144] flex items-center">
            <Crown className="w-6 h-6 mr-2" />
            Программа лояльности
          </h2>
          <button onClick={() => setShowStatusInfo(false)} className="text-gray-500 hover:text-[#385144]">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-3">
          {statusInfo.map((status) => (
            <div 
              key={status.name}
              className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${
                currentStatus === status.name ? 'border-[#385144]' : 'border-gray-100'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`font-bold text-lg ${currentStatus === status.name ? 'text-[#385144]' : 'text-gray-700'}`}>
                    {status.name}
                  </h3>
                  <p className="text-gray-500 text-sm">{status.desc}</p>
                </div>
                <span className="text-gray-400 text-sm font-bold">{status.count}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-[#385144] text-white rounded-2xl p-4">
          <p className="text-sm">💡 Чем выше статус, тем больше преимуществ и специальных предложений!</p>
        </div>
      </div>
    );
  }

  // Модальное окно истории бонусов
  if (showBonusInfo) {
    return (
      <div className="min-h-screen bg-[#F8F5F2] p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#385144] flex items-center">
            <Sparkles className="w-6 h-6 mr-2" />
            История бонусов
          </h2>
          <button onClick={() => setShowBonusInfo(false)} className="text-gray-500 hover:text-[#385144]">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600">Текущий баланс:</span>
            <span className="text-[#D4AF37] font-bold text-2xl">{user.bonus_balance || 0} ₽</span>
          </div>
          <p className="text-gray-500 text-xs">Кэшбэк 5% с каждой консультации</p>
        </div>

        <div className="space-y-3">
          {bonusHistory.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[#385144] font-bold text-sm">
                    {item.services?.title || 'Консультация'}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {new Date(item.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div className="text-right">
                  {item.bonus_paid > 0 && (
                    <p className="text-green-600 font-bold text-sm">+{item.bonus_paid} ₽</p>
                  )}
                  {item.bonus_used > 0 && (
                    <p className="text-red-600 font-bold text-sm">-{item.bonus_used} ₽</p>
                  )}
                  <p className="text-gray-400 text-xs">{item.price} ₽</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {bonusHistory.length === 0 && (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500">История бонусов пуста</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2] p-4 pb-20">
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

        <div className="grid grid-cols-2 gap-3">
          {/* Кликабельная плашка статуса */}
          <button 
            onClick={() => setShowStatusInfo(true)}
            className="bg-[#F8F5F2] rounded-xl p-3 border border-gray-100 hover:border-[#385144] transition text-left"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <Crown className="w-4 h-4 mr-1 text-[#D4AF37]" />
                <span className="text-gray-500 text-xs">Статус</span>
              </div>
              <Info className="w-3 h-3 text-gray-400" />
            </div>
            <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${statusColor}`}>
              {currentStatus}
            </span>
          </button>

          {/* Кликабельная плашка бонусов */}
          <button 
            onClick={() => setShowBonusInfo(true)}
            className="bg-[#F8F5F2] rounded-xl p-3 border border-gray-100 hover:border-[#385144] transition text-left"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <Sparkles className="w-4 h-4 mr-1 text-[#D4AF37]" />
                <span className="text-gray-500 text-xs">Бонусы</span>
              </div>
              <Info className="w-3 h-3 text-gray-400" />
            </div>
            <span className="text-[#D4AF37] font-bold text-lg">
              {user.bonus_balance || 0} ₽
            </span>
          </button>
        </div>
      </div>

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

      <div>
        <h3 className="text-[#385144] font-bold mb-3 flex items-center">
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
                    <span className="mr-1">₽</span>
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