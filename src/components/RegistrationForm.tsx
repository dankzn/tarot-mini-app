import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, MapPin, Phone, Calendar, Save, Users } from 'lucide-react';

interface RegistrationFormProps {
  telegramUser: any;
  onComplete: (userData: any) => Promise<void>;
}

export const RegistrationForm = ({ telegramUser, onComplete }: RegistrationFormProps) => {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const tg = window.Telegram?.WebApp;
      
      if (!tg) {
        console.error('Telegram WebApp не найден');
        setInitError('Telegram WebApp не инициализирован');
        return;
      }

      tg.ready();
      tg.expand();

      const initData = tg.initDataUnsafe;
      console.log('📊 Telegram initData:', initData);
      
      if (initData?.start_param) {
        console.log('🎯 Найден start_param:', initData.start_param);
        
        if (initData.start_param.startsWith('ref_')) {
          const code = initData.start_param.replace('ref_', '');
          setReferralCode(code);
          console.log('✅ Реферальный код:', code);
        }
      } else {
        console.log('ℹ️ start_param не найден');
      }

      if (!telegramUser) {
        console.error('Telegram user data не передан');
        setInitError('Данные пользователя не получены');
      }
    } catch (error) {
      console.error('❌ Ошибка инициализации:', error);
      setInitError('Ошибка инициализации приложения');
    }
  }, [telegramUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const insertData: any = {
        telegram_id: telegramUser.id,
        username: telegramUser.username || null,
        name: name,
        city: city,
        phone: phone,
        birth_date: birthDate || null,
        gender: gender,
        status: 'Первое знакомство',
        bonus_balance: 0,
        role: 'client',
      };

      if (referralCode) {
        insertData.referred_by = parseInt(referralCode);
        console.log('📊 Регистрация с рефералом:', referralCode);
      }

      console.log('📝 Регистрация пользователя:', insertData);

      const { data: user, error } = await supabase
        .from('users')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('❌ Ошибка Supabase:', error);
        throw error;
      }

      console.log('✅ Пользователь создан:', user);

      if (referralCode && user) {
        const { data: referrer, error: referrerError } = await supabase
          .from('users')
          .select('id, bonus_balance, telegram_id')
          .eq('telegram_id', parseInt(referralCode))
          .single();

        if (referrerError) {
          console.error('❌ Ошибка поиска реферера:', referrerError);
        } else if (referrer) {
          const newBalance = (referrer.bonus_balance || 0) + 100;
          
          const { error: updateError } = await supabase
            .from('users')
            .update({ bonus_balance: newBalance })
            .eq('id', referrer.id);

          if (updateError) {
            console.error('❌ Ошибка обновления баланса реферера:', updateError);
          } else {
            console.log('✅ Бонус начислен рефереру:', newBalance);
          }
        }
      }

      await onComplete(user);
    } catch (error: any) {
      console.error('❌ Ошибка регистрации:', error);
      alert('Ошибка регистрации: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (initError) {
    return (
      <div className="min-h-screen bg-[#F8F5F2] p-4 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center">
          <div className="text-red-500 mb-4 text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-[#385144] mb-2">Ошибка</h2>
          <p className="text-gray-600 mb-4">{initError}</p>
          <p className="text-sm text-gray-500">
            Попробуйте закрыть приложение и открыть заново
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2] p-4">
      <div className="max-w-md mx-auto pt-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#385144] to-[#6B4EE6] rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {telegramUser?.first_name?.charAt(0) || 'U'}
          </div>
          <h1 className="text-2xl font-bold text-[#385144] mb-2">Добро пожаловать!</h1>
          <p className="text-gray-600">Заполните данные для регистрации</p>
          
          {referralCode && (
            <div className="mt-3 bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg text-sm">
              ✨ Вас пригласил друг! Вы получите бонус на первую консультацию
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
              <User className="w-4 h-4 mr-2" />
              Ваше имя *
            </label>
            <input
              type="text"
              required
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
              placeholder="Введите ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Пол *
            </label>
            <select
              required
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
              value={gender}
              onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
            >
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
              <option value="other">Не указывать</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
              <MapPin className="w-4 h-4 mr-2" />
              Город *
            </label>
            <input
              type="text"
              required
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
              placeholder="Введите ваш город"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              День рождения
            </label>
            <input
              type="date"
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            <p className="text-gray-500 text-xs mt-1">
              Укажите для получения бонуса на День Рождения
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
              <Phone className="w-4 h-4 mr-2" />
              Телефон
            </label>
            <input
              type="tel"
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
              placeholder="+7 (999) 999-99-99"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#385144] text-white p-4 rounded-xl font-bold hover:bg-[#2d4238] transition disabled:opacity-50 flex items-center justify-center"
          >
            <Save className="w-5 h-5 mr-2" />
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  );
};