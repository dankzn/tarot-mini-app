import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BookingForm } from './BookingForm';
import { ConsultationHistory } from './ConsultationHistory';
import { PrivilegeCards } from './PrivilegeCards';
import { 
  Crown, 
  Sparkles, 
  ScrollText, 
  Gift, 
  CalendarCheck,
  MapPin,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { formatBonusExpiry} from '../lib/bonusLogic';
import { isBirthdaySoon, getBirthdayBonus } from '../lib/bonusLogic';

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
  const [showBonusInfo, setShowBonusInfo] = useState(false);
  const [showPrivileges, setShowPrivileges] = useState(false);
  const [bonusHistory, setBonusHistory] = useState<any[]>([]);
  const [totalConsultations, setTotalConsultations] = useState(0);

  useEffect(() => {
    loadServices();
    loadBonusHistory();
    loadTotalConsultations();
  }, []);

// После существующих useEffect добавь:
useEffect(() => {
  const checkBirthday = async () => {
    if (!user.birth_date) return;
    
    if (isBirthdaySoon(user.birth_date)) {
      const birthdayBonus = getBirthdayBonus(user.status);
      
      if (birthdayBonus > 0) {
        // Проверяем, не начисляли ли уже в этом году
        const { data: existingBonus } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'birthday_bonus')
          .gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString())
          .single();

        if (!existingBonus) {
          // Начисляем бонус
          const newBalance = (user.bonus_balance || 0) + birthdayBonus;
          
          await supabase
            .from('users')
            .update({ bonus_balance: newBalance })
            .eq('id', user.id);

          await supabase
            .from('transactions')
            .insert([
              {
                user_id: user.id,
                type: 'birthday_bonus',
                amount: birthdayBonus,
                description: `Бонус на День Рождения (${getBirthdayBonus(user.status)} ₽)`,
              }
            ]);

          alert(`🎉 С Днём Рождения!\n\nВам начислено ${birthdayBonus} ₽ бонусов!\n\nБонусы действительны 2 дня.`);
        }
      }
    }
  };

  checkBirthday();
}, [user.id, user.birth_date, user.status]);

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

  const loadTotalConsultations = async () => {
    const { count } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed');

    setTotalConsultations(count || 0);
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

  // Модальное окно истории бонусов
  if (showBonusInfo) {
    return (
      <div className="min-h-screen bg-[#F8F5F2] p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#385144] flex items-center">
            <Sparkles className="w-6 h-6 mr-2" />
            История бонусов
          </h2>
          <button 
            onClick={() => setShowBonusInfo(true)}
            className="bg-[#F8F5F2] rounded-xl p-3 border border-gray-100 hover:border-[#385144] transition text-left"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <Sparkles className="w-4 h-4 mr-1 text-[#D4AF37]" />
                <span className="text-gray-500 text-xs">Бонусы</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
            <span className="text-[#D4AF37] font-bold text-lg">
              {user.bonus_balance || 0} ₽
            </span>
            <p className="text-gray-400 text-xs mt-1">
              Действуют до {formatBonusExpiry(user.last_bonus_date || user.created_at, user.status)}
            </p>
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
      {/* Карточка пользователя */}
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
          {/* Кликабельная плашка статуса - открывает PrivilegeCards */}
          <button 
            onClick={() => setShowPrivileges(true)}
            className="bg-[#F8F5F2] rounded-xl p-3 border border-gray-100 hover:border-[#385144] transition text-left"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <Crown className="w-4 h-4 mr-1 text-[#D4AF37]" />
                <span className="text-gray-500 text-xs">Статус</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
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
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
            <span className="text-[#D4AF37] font-bold text-lg">
              {user.bonus_balance || 0} ₽
            </span>
          </button>
        </div>
      </div>

      {/* Кнопки навигации */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        <button 
          onClick={() => setShowHistory(true)}
          className="bg-white text-[#385144] p-4 rounded-xl font-bold text-left flex items-center justify-between hover:bg-gray-50 transition border border-gray-100 shadow-sm"
        >
          <div className="flex items-center">
            <ScrollText className="w-5 h-5 mr-3 text-[#6B4EE6]" />
            <span>История консультаций</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>

        <button className="bg-white text-[#385144] p-4 rounded-xl font-bold text-left flex items-center justify-between hover:bg-gray-50 transition border border-gray-100 shadow-sm">
          <div className="flex items-center">
            <Gift className="w-5 h-5 mr-3 text-[#6B4EE6]" />
            <span>Пригласить друга</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Список услуг */}
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

      {/* Модальное окно PrivilegeCards */}
      {showPrivileges && (
        <PrivilegeCards 
          currentStatus={currentStatus}
          totalConsultations={totalConsultations}
          onClose={() => setShowPrivileges(false)}
        />
      )}
    </div>
  );
};