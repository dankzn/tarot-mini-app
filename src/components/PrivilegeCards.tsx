import { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Gift, 
  Clock,
  Crown,
  Star,
  Zap,
  Trophy,
  X
} from 'lucide-react';

interface PrivilegeLevel {
  id: string;
  name: string;
  icon: any;
  color: string;
  bgColor: string;
  consultations: string;
  bonusPercent: string;
  bonusDuration: string;
  bonusAfter?: string;
  birthdayBonus: string;
  additionalBenefits: string[];
  description: string;
}

interface PrivilegeCardsProps {
  currentStatus: string;
  totalConsultations: number;
  onClose?: () => void;
}

const PRIVILEGE_LEVELS: PrivilegeLevel[] = [
  {
    id: 'first',
    name: 'Первое знакомство',
    icon: Sparkles,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    consultations: '0 консультаций',
    bonusPercent: '10%',
    bonusDuration: '30 дней',
    bonusAfter: '3% на 365 дней',
    birthdayBonus: '—',
    additionalBenefits: [
      'Начальный уровень',
      '10% бонусов за консультацию (можно использовать в течение 30 дней)',
      'После 30 дней — 3% на 365 дней',
      'Остальные бонусы сгорают после 30 дней'
    ],
    description: 'Начни своё путешествие в мир таро'
  },
  {
    id: 'basic',
    name: 'Basic',
    icon: Star,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    consultations: '1-2 консультации',
    bonusPercent: '2%',
    bonusDuration: '365 дней',
    birthdayBonus: '50 ₽',
    additionalBenefits: [
      'Базовый уровень',
      '2% бонусами на срок 365 дней',
      '50 рублей бонусами на День Рождения',
      'Бонусы сгорают через 2 дня после ДР'
    ],
    description: 'Базовые привилегии для постоянных клиентов'
  },
  {
    id: 'silver',
    name: 'Silver',
    icon: Trophy,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    consultations: '3-5 консультаций',
    bonusPercent: '5%',
    bonusDuration: '365 дней',
    birthdayBonus: '100 ₽',
    additionalBenefits: [
      'Серебряный уровень',
      '5% бонусами на срок 365 дней',
      '100 рублей бонусами на День Рождения',
      '1 мини-расклад на базовый запрос (30 минут)',
      'При оплаченной консультации за текущие 30 дней'
    ],
    description: 'Серебряный статус с дополнительными бонусами'
  },
  {
    id: 'gold',
    name: 'Gold',
    icon: Crown,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    consultations: '6-10 консультаций',
    bonusPercent: '7%',
    bonusDuration: '365 дней',
    birthdayBonus: '150 ₽',
    additionalBenefits: [
      'Золотой уровень',
      '7% бонусами на срок 365 дней',
      '150 рублей на День Рождения',
      '1 мини-расклад (30 минут)',
      '1 полноценный базовый расклад (60 минут)',
      'При оплаченной консультации за текущие 30 дней'
    ],
    description: 'Золотой статус с максимальными привилегиями'
  },
  {
    id: 'platinum',
    name: 'Platinum',
    icon: Zap,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    consultations: '11+ консультаций',
    bonusPercent: '9%',
    bonusDuration: '365 дней',
    birthdayBonus: '200 ₽',
    additionalBenefits: [
      'Платиновый статус',
      '9% бонусами на срок 365 дней',
      '200 рублей на День рождения',
      '2 полноценных расклада (60 минут каждый)',
      'При неоплаченной консультации за 30 дней — 1 бесплатная консультация за период 6 месяцев'
    ],
    description: 'Элитный статус для самых преданных клиентов'
  }
];

export const PrivilegeCards = ({ currentStatus, totalConsultations, onClose }: PrivilegeCardsProps) => {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const statusIndex = PRIVILEGE_LEVELS.findIndex(level => level.name === currentStatus);
    return statusIndex >= 0 ? statusIndex : 0;
  });

  const currentLevel = PRIVILEGE_LEVELS[currentIndex];
  const Icon = currentLevel.icon;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < PRIVILEGE_LEVELS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const getStatusIndex = (statusName: string) => {
    return PRIVILEGE_LEVELS.findIndex(level => level.name === statusName);
  };

  const currentStatusIndex = getStatusIndex(currentStatus);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col">
        {/* Шапка — фиксированная */}
        <div className="flex-none border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#385144]">Уровни привилегий</h2>
          {onClose && (
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition p-2"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Индикаторы — фиксированные */}
        <div className="flex-none flex justify-center gap-2 p-4 border-b border-gray-100">
          {PRIVILEGE_LEVELS.map((_, index) => {
            const isActive = index === currentIndex;
            const isCurrentStatus = index === currentStatusIndex;
            
            return (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition ${
                  isCurrentStatus 
                    ? 'bg-[#385144] w-4' 
                    : isActive 
                      ? 'bg-[#385144]/50' 
                      : 'bg-gray-300'
                }`}
              />
            );
          })}
        </div>

        {/* Контент с прокруткой */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Карточка */}
          <div className={`rounded-2xl p-6 mb-6 transition-all ${
            currentIndex === currentStatusIndex 
              ? `${currentLevel.bgColor} border-2 border-[#385144] shadow-lg` 
              : 'bg-gray-100 border-2 border-gray-200 opacity-60'
          }`}>
            {/* Иконка и название */}
            <div className="flex items-center justify-center mb-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                currentIndex === currentStatusIndex 
                  ? currentLevel.bgColor 
                  : 'bg-gray-200'
              }`}>
                <Icon className={`w-8 h-8 ${
                  currentIndex === currentStatusIndex 
                    ? currentLevel.color 
                    : 'text-gray-400'
                }`} />
              </div>
            </div>

            <h3 className={`text-2xl font-bold text-center mb-2 ${
              currentIndex === currentStatusIndex 
                ? currentLevel.color 
                : 'text-gray-400'
            }`}>
              {currentLevel.name}
            </h3>

            {currentIndex === currentStatusIndex && (
              <div className="flex items-center justify-center gap-1 mb-4">
                <span className="text-green-600 text-sm font-bold">✓ Ваш текущий уровень</span>
              </div>
            )}

            <p className="text-gray-600 text-center text-sm mb-6">
              {currentLevel.description}
            </p>

            {/* Информация */}
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600 text-sm">Консультаций:</span>
                <span className={`font-bold ${
                  currentIndex === currentStatusIndex ? 'text-[#385144]' : 'text-gray-400'
                }`}>
                  {currentLevel.consultations}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600 text-sm flex items-center gap-1">
                  <Gift className="w-4 h-4" />
                  Процент бонусов:
                </span>
                <span className={`font-bold ${
                  currentIndex === currentStatusIndex ? 'text-[#385144]' : 'text-gray-400'
                }`}>
                  {currentLevel.bonusPercent}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600 text-sm flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Срок действия:
                </span>
                <span className={`font-bold ${
                  currentIndex === currentStatusIndex ? 'text-[#385144]' : 'text-gray-400'
                }`}>
                  {currentLevel.bonusDuration}
                </span>
              </div>

              {currentLevel.bonusAfter && (
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 text-sm">После:</span>
                  <span className={`font-bold text-sm ${
                    currentIndex === currentStatusIndex ? 'text-[#385144]' : 'text-gray-400'
                  }`}>
                    {currentLevel.bonusAfter}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600 text-sm flex items-center gap-1">
                  <Gift className="w-4 h-4" />
                  На День Рождения:
                </span>
                <span className={`font-bold ${
                  currentIndex === currentStatusIndex ? 'text-[#385144]' : 'text-gray-400'
                }`}>
                  {currentLevel.birthdayBonus}
                </span>
              </div>
            </div>

            {/* Дополнительные преимущества */}
            <div className="mt-6">
              <h4 className={`font-bold mb-3 flex items-center gap-2 ${
                currentIndex === currentStatusIndex ? 'text-[#385144]' : 'text-gray-400'
              }`}>
                <Sparkles className="w-4 h-4" />
                Преимущества:
              </h4>
              <ul className="space-y-2">
                {currentLevel.additionalBenefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      currentIndex === currentStatusIndex ? 'bg-[#385144]' : 'bg-gray-400'
                    }`} />
                    <span className={currentIndex === currentStatusIndex ? 'text-gray-700' : 'text-gray-400'}>
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Прогресс до следующего уровня */}
          {currentIndex < PRIVILEGE_LEVELS.length - 1 && currentIndex === currentStatusIndex && (
            <div className="bg-[#F8F5F2] p-4 rounded-xl mb-4">
              <p className="text-gray-600 text-sm text-center mb-2">
                До следующего уровня:
              </p>
              <div className="flex justify-between items-center">
                <span className="text-[#385144] font-bold text-sm">
                  {PRIVILEGE_LEVELS[currentIndex + 1].name}
                </span>
                <span className="text-gray-500 text-xs">
                  {totalConsultations} / {PRIVILEGE_LEVELS[currentIndex + 1].consultations.split(' ')[0]}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-[#385144] h-2 rounded-full transition-all"
                  style={{ 
                    width: `${Math.min((totalConsultations / parseInt(PRIVILEGE_LEVELS[currentIndex + 1].consultations.split(' ')[0])) * 100, 100)}%` 
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Навигация — фиксированная внизу */}
        <div className="flex-none border-t border-gray-200 p-4 flex justify-between items-center">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-3 rounded-xl bg-[#F8F5F2] text-[#385144] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#385144] hover:text-white transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <span className="text-gray-500 text-sm">
            {currentIndex + 1} из {PRIVILEGE_LEVELS.length}
          </span>

          <button
            onClick={handleNext}
            disabled={currentIndex === PRIVILEGE_LEVELS.length - 1}
            className="p-3 rounded-xl bg-[#F8F5F2] text-[#385144] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#385144] hover:text-white transition"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};