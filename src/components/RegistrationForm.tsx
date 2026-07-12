import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, MapPin, Phone, Calendar, Save, Users, Mail, Lock } from 'lucide-react';
import { notifyAdminNewUserRegistration } from '../lib/notifications';

interface RegistrationFormProps {
  telegramUser: any;
  onComplete: (userData: any) => Promise<void>;
}

export const RegistrationForm = ({ telegramUser, onComplete }: RegistrationFormProps) => {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initReferral = async () => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        
        if (!tg) {
          console.error('❌ Telegram WebApp не найден');
          setInitError('Telegram WebApp не инициализирован');
          return;
        }

        tg.ready();
        tg.expand();

        const initData = tg.initDataUnsafe;
        const telegramId = initData?.user?.id || telegramUser?.id;
        
        console.log('📊 Telegram ID:', telegramId);
        
        if (!telegramId) {
          console.error('❌ Telegram ID не получен');
          setInitError('Не удалось получить ID пользователя');
          return;
        }

        let refCode: string | null = null;

        // 1. Проверяем pending_referrals
        console.log('🔍 Проверяем pending_referrals для telegram_id:', telegramId);
        
        const { data: pendingReferral, error } = await supabase
          .from('pending_referrals')
          .select('referrer_telegram_id')
          .eq('telegram_id', telegramId)
          .eq('used', false)
          .single();

        if (error) {
          console.log('⚠️ Pending referral не найден:', error.message);
        } else if (pendingReferral) {
          refCode = pendingReferral.referrer_telegram_id.toString();
          console.log('✅ Реферальный код из pending_referrals:', refCode);
        }

        // 2. Проверяем URL параметры
        if (!refCode) {
          const urlParams = new URLSearchParams(window.location.search);
          const urlRef = urlParams.get('ref');
          
          if (urlRef) {
            refCode = urlRef;
            console.log('✅ Реферальный код из URL:', refCode);
          }
        }
        
        if (refCode) {
          setReferralCode(refCode);
          console.log('✅ Установлен реферальный код:', refCode);
        } else {
          console.log('ℹ️ Реферальный код отсутствует');
        }

      } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        setInitError('Ошибка инициализации приложения');
      }
    };

    initReferral();
  }, [telegramUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      alert('Пароль должен быть от 8 символов');
      return;
    }

    if (password !== passwordRepeat) {
      alert('Пароли не совпадают');
      return;
    }

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
        email: email.trim().toLowerCase(),
        status: 'Первое знакомство',
        bonus_balance: 0,
        role: 'client',
      };

      // Сохраняем telegram_id реферера (число)
      if (referralCode) {
        const refId = parseInt(referralCode, 10);
        if (!isNaN(refId)) {
          insertData.referred_by = refId;
          console.log('📊 Регистрация с рефералом, referred_by =', refId);
        }
      }

      console.log('📝 Данные для вставки:', insertData);

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

      const credentialsResponse = await fetch('/api/site/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: telegramUser.id,
          email,
          password,
        }),
      });
      const credentialsPayload = await credentialsResponse.json().catch(() => null);

      if (!credentialsResponse.ok || !credentialsPayload?.ok) {
        throw new Error(credentialsPayload?.error || 'Не удалось сохранить вход на сайт');
      }

      try {
        const { data: adminsData } = await supabase
          .from('users')
          .select('telegram_id')
          .eq('role', 'admin')
          .not('telegram_id', 'is', null);

        const adminTelegramIds = [
          ...new Set((adminsData || []).map((admin: any) => admin.telegram_id).filter(Boolean)),
        ];

        const notificationResult = await notifyAdminNewUserRegistration(
          adminTelegramIds,
          user.name || name || 'Новый клиент',
          user.username || telegramUser.username || null,
          user.telegram_id || telegramUser.id,
          user.city || city || null,
          user.referred_by || null
        );

        if (!notificationResult.ok) {
          console.warn('⚠️ Уведомление о новой регистрации не отправлено:', notificationResult.error);
        }
      } catch (notificationError) {
        console.warn('⚠️ Ошибка уведомления о новой регистрации:', notificationError);
      }

      // Помечаем pending referral как использованный
      if (referralCode && telegramUser?.id) {
        await supabase
          .from('pending_referrals')
          .update({ used: true })
          .eq('telegram_id', telegramUser.id)
          .eq('used', false);
      }

      // Начисляем бонус рефереру
      if (referralCode) {
        const refId = parseInt(referralCode, 10);
        
        const { data: referrer, error: referrerError } = await supabase
          .from('users')
          .select('id, bonus_balance')
          .eq('telegram_id', refId)
          .single();

        if (!referrerError && referrer) {
          const newBalance = (referrer.bonus_balance || 0) + 100;
          
          await supabase
            .from('users')
            .update({ bonus_balance: newBalance })
            .eq('id', referrer.id);

          console.log('✅ Бонус начислен рефереру:', newBalance);
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
          <button
            onClick={() => window.location.reload()}
            className="bg-[#385144] text-white px-4 py-2 rounded-lg"
          >
            Обновить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2] p-4">
      <div className="max-w-md mx-auto pt-6">
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#385144] via-[#6A7C69] to-[#B8795C] rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {telegramUser?.first_name?.charAt(0) || 'U'}
          </div>
          <h1 className="text-2xl font-bold text-[#385144] mb-2">Добро пожаловать!</h1>
          <p className="text-gray-600">Заполните данные для регистрации</p>
          
          {referralCode && (
            <div className="mt-3 bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg text-sm">
              ✨ Вас пригласил друг! Вы получите бонус
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
              <User className="w-4 h-4 mr-2" />
              Telegram
            </label>
            <input
              type="text"
              readOnly
              className="w-full p-3 bg-[#EDE7DE] border border-gray-200 rounded-lg text-gray-500 font-bold focus:outline-none"
              value={telegramUser?.username ? `@${telegramUser.username}` : String(telegramUser?.id || '')}
            />
          </div>

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
              <option value="female">Женский</option>
              <option value="male">Мужской</option>
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

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
              <Mail className="w-4 h-4 mr-2" />
              Почта для входа на сайт *
            </label>
            <input
              type="email"
              required
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
              placeholder="mail@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                <Lock className="w-4 h-4 mr-2" />
                Пароль *
              </label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                placeholder="от 8 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                <Lock className="w-4 h-4 mr-2" />
                Повтор *
              </label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                placeholder="ещё раз"
                value={passwordRepeat}
                onChange={(e) => setPasswordRepeat(e.target.value)}
              />
            </div>
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
