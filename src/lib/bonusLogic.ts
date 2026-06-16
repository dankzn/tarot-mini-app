// Процент бонусов в зависимости от статуса
export const getBonusPercent = (status: string): number => {
  const percentages: Record<string, number> = {
    'Первое знакомство': 10, // Первые 30 дней
    'Basic': 2,
    'Silver': 5,
    'Gold': 7,
    'Platinum': 9,
    'Личное ведение': 5, // Индивидуально
  };
  return percentages[status] || 5;
};

// Процент после 30 дней для "Первое знакомство"
export const getBonusPercentAfter30Days = (status: string): number => {
  if (status === 'Первое знакомство') return 3;
  return getBonusPercent(status);
};

// Срок действия бонусов (в днях)
export const getBonusDuration = (status: string): number => {
  const durations: Record<string, number> = {
    'Первое знакомство': 30, // Первые 30 дней 10%, потом 3% на 365 дней
    'Basic': 365,
    'Silver': 365,
    'Gold': 365,
    'Platinum': 365,
    'Личное ведение': 30,
  };
  return durations[status] || 365;
};

// Бонус на День Рождения
export const getBirthdayBonus = (status: string): number => {
  const bonuses: Record<string, number> = {
    'Первое знакомство': 0,
    'Basic': 50,
    'Silver': 100,
    'Gold': 150,
    'Platinum': 200,
    'Личное ведение': 0,
  };
  return bonuses[status] || 0;
};

// Срок сгорания бонусов ДР (в днях)
export const getBirthdayBonusExpiryDays = (): number => {
  return 2; // 2 дня после ДР
};

// Проверка: является ли сегодня день рождения (или в ближайшие 7 дней)
export const isBirthdaySoon = (birthDate: string | null): boolean => {
  if (!birthDate) return false;
  
  const today = new Date();
  const birth = new Date(birthDate);
  
  // Устанавливаем год на текущий
  birth.setFullYear(today.getFullYear());
  
  // Разница в днях
  const diffTime = birth.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // День рождения сегодня или в ближайшие 7 дней
  return diffDays >= 0 && diffDays <= 7;
};

// Проверка: прошло ли 2 дня после ДР (бонусы сгорают)
export const isBirthdayBonusExpired = (birthDate: string | null, bonusCreatedAt: string): boolean => {
  if (!birthDate) return false;
  
  const birth = new Date(birthDate);
  const bonusCreated = new Date(bonusCreatedAt);
  
  // Устанавливаем год ДР на год создания бонуса
  birth.setFullYear(bonusCreated.getFullYear());
  
  // Если бонус создан после ДР
  if (bonusCreated < birth) {
    birth.setFullYear(bonusCreated.getFullYear() - 1);
  }
  
  // Прошло ли 2 дня после ДР
  const twoDaysAfterBirthday = new Date(birth);
  twoDaysAfterBirthday.setDate(birth.getDate() + 2);
  
  return bonusCreated > twoDaysAfterBirthday;
};

// Расчёт бонусов за консультацию
export const calculateBonus = (
  status: string,
  price: number
): number => {
  const percent = getBonusPercent(status);
  return Math.floor(price * (percent / 100));
};

// Проверка: нужно ли применить пониженный процент (3% вместо 10%)
export const shouldApplyReducedBonus = (
  status: string,
  consultationDate: Date,
  statusUpdatedAt: Date | null
): boolean => {
  if (status !== 'Первое знакомство') return false;
  if (!statusUpdatedAt) return false;
  
  // Прошло ли 30 дней с момента получения статуса
  const daysSinceStatus = (consultationDate.getTime() - statusUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceStatus > 30;
};

// Форматирование даты сгорания бонусов
export const formatBonusExpiry = (createdAt: string, status: string): string => {
  const created = new Date(createdAt);
  const duration = getBonusDuration(status);
  
  const expiry = new Date(created);
  expiry.setDate(created.getDate() + duration);
  
  return expiry.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};