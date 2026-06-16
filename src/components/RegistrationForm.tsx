import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, MapPin, Phone, Mail, Save } from 'lucide-react';

interface RegistrationFormProps {
  telegramUser: any;
  onComplete: (userData: any) => Promise<void>;
}

export const RegistrationForm = ({ telegramUser, onComplete }: RegistrationFormProps) => {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: user, error } = await supabase
        .from('users')
        .insert([
          {
            telegram_id: telegramUser.id,
            username: telegramUser.username || null, // ← ВОТ ЭТО
            name: name,
            city: city,
            phone: phone,
            email: email,
            status: 'Первое знакомство',
            bonus_balance: 0,
            role: 'client',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await onComplete(user);
    } catch (error: any) {
      alert('Ошибка регистрации: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F5F2] p-4">
      <div className="max-w-md mx-auto pt-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#385144] to-[#6B4EE6] rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {telegramUser.first_name?.charAt(0) || 'U'}
          </div>
          <h1 className="text-2xl font-bold text-[#385144] mb-2">Добро пожаловать!</h1>
          <p className="text-gray-600">Заполните данные для регистрации</p>
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
              Email
            </label>
            <input
              type="email"
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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