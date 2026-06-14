import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { getTelegramUser, getStartParam } from '../lib/telegram';

interface RegistrationFormProps {
  onSuccess: (user: any) => void;
}

export const RegistrationForm = ({ onSuccess }: RegistrationFormProps) => {
  const [loading, setLoading] = useState(false);
  
  const tgUser = getTelegramUser();
  const startParam = getStartParam();

  const [formData, setFormData] = useState({
    last_name: '',
    first_name: tgUser?.first_name || '',
    patronymic: '',
    city: '',
    birth_date: '',
    gender: 'female' as 'male' | 'female' | 'other',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let referredBy: string | null = null;
      if (startParam && startParam.startsWith('ref_')) {
        referredBy = startParam.replace('ref_', '');
      }

      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            telegram_id: tgUser?.id,
            last_name: formData.last_name,
            name: `${formData.last_name} ${formData.first_name} ${formData.patronymic}`.trim(),
            city: formData.city,
            birth_date: formData.birth_date,
            gender: formData.gender,
            referred_by: referredBy,
            status: 'Первое знакомство',
            bonus_balance: 0,
            referrals_count: 0,
            consultations_count: 0,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onSuccess(data);
    } catch (error: any) {
      console.error('Ошибка регистрации:', error);
      alert('Ошибка: ' + error.message);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0b2e] to-[#2d1b4e] px-4 py-6 flex flex-col">
      <div className="text-center mb-6">
        <div className="text-5xl mb-4">✨</div>
        <h2 className="text-2xl font-bold text-white mb-2">Создание профиля</h2>
        <p className="text-purple-300 text-sm">
          Заполните данные для получения персональных бонусов и скидок
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-md mx-auto flex-1">
        <div>
          <label className="text-purple-200 text-sm mb-1 block">Фамилия *</label>
          <input
            required
            type="text"
            className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
          />
        </div>

        <div>
          <label className="text-purple-200 text-sm mb-1 block">Имя *</label>
          <input
            required
            type="text"
            className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
          />
        </div>

        <div>
          <label className="text-purple-200 text-sm mb-1 block">Отчество</label>
          <input
            type="text"
            className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
            value={formData.patronymic}
            onChange={(e) => setFormData({ ...formData, patronymic: e.target.value })}
          />
        </div>

        <div>
          <label className="text-purple-200 text-sm mb-1 block">Город *</label>
          <input
            required
            type="text"
            className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          />
        </div>

        {/* Дата рождения - ОТДЕЛЬНО */}
        <div className="w-full">
          <label className="text-purple-200 text-sm mb-1 block">Дата рождения *</label>
          <input
            required
            type="date"
            className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400"
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
          />
        </div>

        {/* Пол - ОТДЕЛЬНО */}
        <div className="w-full">
          <label className="text-purple-200 text-sm mb-1 block">Пол *</label>
          <select
            className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400"
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
          >
            <option value="female" className="bg-purple-900">Женский</option>
            <option value="male" className="bg-purple-900">Мужской</option>
          </select>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white p-4 rounded-lg font-bold hover:from-purple-700 hover:to-purple-900 transition disabled:opacity-50"
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </div>
      </form>
    </div>
  );
};