import { supabase } from './supabase';

// ============================================
// ТВОЯ СУЩЕСТВУЮЩАЯ ЛОГИКА (НЕ МЕНЯЕМ!)
// ============================================

// Процент бонусов в зависимости от статуса
export const getBonusPercent = (status: string): number => {
  const percentages: Record<string, number> = {
    'Первое знакомство': 10, // Первые 30 дней
    'Basic': 2,
    'Silver': 5,
    'Gold': 7,
    'Platinum': 9,
  };
  return percentages[status] || 5;
};

export const getLoyaltyStatusByCompletedConsultations = (consultationCount: number): string => {
  if (consultationCount <= 0) return 'Первое знакомство';
  if (consultationCount <= 2) return 'Basic';
  if (consultationCount <= 5) return 'Silver';
  if (consultationCount <= 10) return 'Gold';
  return 'Platinum';
};

export const isPersonalTarologistService = (serviceTitle: string | null | undefined): boolean => {
  const normalizedTitle = serviceTitle?.toLowerCase() || '';
  return normalizedTitle.includes('личный таролог') || normalizedTitle.includes('личное ведение');
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

// ============================================
// НОВАЯ ЛОГИКА: РЕФЕРАЛЬНАЯ СИСТЕМА
// ============================================

// Процент реферального бонуса (от стоимости консультации)
export const REFERRAL_BONUS_PERCENT = 5; // 5%

/**
 * Начисление реферальных бонусов при завершении консультации
 * 
 * Логика:
 * 1. Когда консультация завершается (status = 'completed')
 * 2. Проверяем, есть ли у клиента реферер (referred_by)
 * 3. Если есть - начисляем бонусы:
 *    - Рефереру: 5% от стоимости консультации
 *    - Клиенту: стандартный бонус по его статусу
 * 
 * @param consultationId - ID консультации
 */
export const processReferralBonus = async (consultationId: string) => {
  try {
    // Получаем консультацию
    const { data: consultation, error: consultError } = await supabase
      .from('consultations')
      .select('user_id, price, status')
      .eq('id', consultationId)
      .single();

    if (consultError || !consultation) {
      console.error('❌ Ошибка получения консультации:', consultError);
      return;
    }

    // Получаем данные клиента
    const { data: client, error: clientError } = await supabase
      .from('users')
      .select('id, telegram_id, referred_by, bonus_balance, status')
      .eq('id', consultation.user_id)
      .single();

    if (clientError || !client) {
      console.error('❌ Ошибка получения клиента:', clientError);
      return;
    }

    // Если у клиента есть реферер
    if (client.referred_by) {
      // Находим реферера по telegram_id
      const { data: referrer, error: referrerError } = await supabase
        .from('users')
        .select('id, telegram_id, bonus_balance, status')
        .eq('telegram_id', client.referred_by)
        .single();

      if (referrerError || !referrer) {
        console.error('❌ Реферер не найден:', referrerError);
        return;
      }

      // Рассчитываем бонус для реферера (5% от стоимости)
      const referrerBonus = Math.floor(consultation.price * (REFERRAL_BONUS_PERCENT / 100));
      const newReferrerBalance = (referrer.bonus_balance || 0) + referrerBonus;
      
      // Обновляем баланс реферера
      const { error: updateReferrerError } = await supabase
        .from('users')
        .update({ bonus_balance: newReferrerBalance })
        .eq('id', referrer.id);

      if (updateReferrerError) {
        console.error('❌ Ошибка обновления баланса реферера:', updateReferrerError);
        return;
      }

      console.log(`✅ Рефереру ${referrer.telegram_id} начислено ${referrerBonus} бонусов (5% от ${consultation.price}₽)`);

      // Рассчитываем бонус для клиента (по его статусу)
      const clientBonus = calculateBonus(client.status, consultation.price);
      const newClientBalance = (client.bonus_balance || 0) + clientBonus;
      
      // Обновляем баланс клиента
      const { error: updateClientError } = await supabase
        .from('users')
        .update({ bonus_balance: newClientBalance })
        .eq('id', client.id);

      if (updateClientError) {
        console.error('❌ Ошибка обновления баланса клиента:', updateClientError);
        return;
      }

      console.log(`✅ Клиенту ${client.telegram_id} начислено ${clientBonus} бонусов (по статусу "${client.status}")`);
    } else {
      console.log('ℹ️ У клиента нет реферера - начисляем бонус только клиенту');
      
      // Начисляем бонус только клиенту
      const clientBonus = calculateBonus(client.status, consultation.price);
      const newClientBalance = (client.bonus_balance || 0) + clientBonus;
      
      const { error: updateClientError } = await supabase
        .from('users')
        .update({ bonus_balance: newClientBalance })
        .eq('id', client.id);

      if (updateClientError) {
        console.error('❌ Ошибка обновления баланса клиента:', updateClientError);
        return;
      }

      console.log(`✅ Клиенту ${client.telegram_id} начислено ${clientBonus} бонусов`);
    }
  } catch (error) {
    console.error('❌ Ошибка обработки реферальных бонусов:', error);
  }
};

/**
 * Получение количества приведенных клиентов для пользователя
 * 
 * @param telegramId - Telegram ID пользователя
 * @returns Количество приведенных клиентов
 */
export const getReferralsCount = async (telegramId: number): Promise<number> => {
  try {
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', telegramId);
    
    return count || 0;
  } catch (error) {
    console.error('Ошибка получения количества рефералов:', error);
    return 0;
  }
};

/**
 * Получение списка всех рефералов пользователя
 * 
 * @param telegramId - Telegram ID пользователя
 * @returns Массив пользователей-рефералов
 */
export const getReferralsList = async (telegramId: number) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, telegram_id, created_at, status')
      .eq('referred_by', telegramId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Ошибка получения списка рефералов:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Ошибка получения списка рефералов:', error);
    return [];
  }
};

/**
 * Получение общего дохода от рефералов (сумма консультаций)
 * 
 * @param telegramId - Telegram ID пользователя
 * @returns Общая сумма консультаций приведенных клиентов
 */
export const getReferralsTotalRevenue = async (telegramId: number): Promise<number> => {
  try {
    // Получаем всех рефералов
    const referrals = await getReferralsList(telegramId);
    
    if (referrals.length === 0) return 0;
    
    // Получаем ID рефералов
    const referralIds = referrals.map(r => r.id);
    
    // Считаем сумму завершенных консультаций
    const { data: consultations, error } = await supabase
      .from('consultations')
      .select('price')
      .in('user_id', referralIds)
      .eq('status', 'completed');
    
    if (error) {
      console.error('Ошибка получения дохода от рефералов:', error);
      return 0;
    }
    
    const total = consultations?.reduce((sum, c) => sum + (c.price || 0), 0) || 0;
    return total;
  } catch (error) {
    console.error('Ошибка расчета дохода от рефералов:', error);
    return 0;
  }
};
