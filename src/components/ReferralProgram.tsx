import { useState, useEffect } from 'react';
import { X, Gift, Copy, CheckCircle, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ReferralProgramProps {
  user: any;
  onClose: () => void;
}

export const ReferralProgram = ({ user, onClose }: ReferralProgramProps) => {
  const [referralLink, setReferralLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    // Формируем реферальную ссылку
    const botUsername = 'danil_tarot_bot';
    const link = `https://t.me/${botUsername}?start=ref_${user.telegram_id}`;
    setReferralLink(link);

    // Загружаем количество рефералов
    loadReferralCount();
  }, [user.telegram_id]);

  const loadReferralCount = async () => {
    console.log('🔍 Загрузка рефералов для telegram_id:', user.telegram_id);
    
    // Ищем по telegram_id (число)
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', user.telegram_id);

    if (error) {
      console.error('❌ Ошибка загрузки рефералов:', error);
      return;
    }

    console.log('✅ Найдено рефералов:', count);
    setReferralCount(count || 0);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Приглашаю тебя на консультацию к тарологу Даниилу! ✨')}`;
    window.open(shareUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
        {/* Шапка */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center rounded-t-3xl z-10">
          <h2 className="text-xl font-bold text-[#385144] flex items-center">
            <Gift className="w-6 h-6 mr-2 text-[#6B4EE6]" />
            Пригласи друга
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Статистика */}
          <div className="bg-gradient-to-br from-[#6B4EE6] to-[#385144] rounded-2xl p-5 mb-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">Вы пригласили:</span>
              <Users className="w-5 h-5" />
            </div>
            <div className="text-3xl font-bold">{referralCount}</div>
            <div className="text-white/80 text-sm mt-1">
              {referralCount === 0 
                ? 'Пригласите первого друга!' 
                : referralCount < 3 
                  ? `Ещё ${3 - referralCount} до бонуса`
                  : 'Отличный результат! 🎉'
              }
            </div>
          </div>

          {/* Условия */}
          <div className="bg-[#F8F5F2] p-4 rounded-xl mb-6">
            <h3 className="text-[#385144] font-bold mb-3">Условия программы:</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#385144] mt-1.5 flex-shrink-0" />
                <span>Приглашённый друг получает <strong>10% бонусов</strong> на первую консультацию</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#385144] mt-1.5 flex-shrink-0" />
                <span>Вы получаете <strong>5% бонусов</strong> от суммы оплаты друга</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#385144] mt-1.5 flex-shrink-0" />
                <span>Бонусы начисляются после завершённой консультации друга</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#385144] mt-1.5 flex-shrink-0" />
                <span>Пригласите 3+ друзей и получите <strong>бесплатный мини-расклад</strong></span>
              </li>
            </ul>
          </div>

          {/* Ссылка */}
          <div className="mb-6">
            <label className="text-[#385144] font-bold text-sm mb-2 block">
              Ваша реферальная ссылка:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 text-sm focus:outline-none"
              />
              <button
                onClick={copyLink}
                className={`px-4 rounded-lg font-bold transition flex items-center gap-1 ${
                  copied 
                    ? 'bg-green-500 text-white' 
                    : 'bg-[#385144] text-white hover:bg-[#2d4238]'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="text-xs">Копировать</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Кнопка поделиться */}
          <button
            onClick={shareLink}
            className="w-full bg-[#6B4EE6] text-white py-3 rounded-xl font-bold hover:bg-[#5a3fd4] transition flex items-center justify-center gap-2"
          >
            <Gift className="w-5 h-5" />
            Поделиться в Telegram
          </button>
        </div>
      </div>
    </div>
  );
};