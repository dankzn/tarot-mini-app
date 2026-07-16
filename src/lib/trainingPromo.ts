type PromoCodeRow = {
  id: string;
  code: string;
  title?: string | null;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  is_active?: boolean | null;
  starts_at?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  applies_to?: string | null;
};

type SupabaseLike = {
  from: (table: string) => any;
};

export type AppliedTrainingPromo = {
  id: string;
  code: string;
  title?: string | null;
  discount: number;
  finalPrice: number;
  originalPrice: number;
};

export const normalizeTrainingPromoCode = (value: string) => (
  value.trim().replace(/\s+/g, '').toUpperCase()
);

export const calculateTrainingPromoDiscount = (price: number, promoCode: Pick<PromoCodeRow, 'discount_type' | 'discount_value'>) => {
  const basePrice = Math.max(0, Math.round(Number(price || 0)));
  const rawDiscount = promoCode.discount_type === 'percent'
    ? Math.round(basePrice * Number(promoCode.discount_value || 0) / 100)
    : Math.round(Number(promoCode.discount_value || 0));

  return Math.min(basePrice, Math.max(0, rawDiscount));
};

export const validateTrainingPromoCode = async (
  supabase: SupabaseLike,
  userId: string | null | undefined,
  rawCode: string,
  price: number,
): Promise<AppliedTrainingPromo> => {
  const code = normalizeTrainingPromoCode(rawCode);
  const originalPrice = Math.max(0, Math.round(Number(price || 0)));

  if (!code) throw new Error('Введите промокод');
  if (!userId) throw new Error('Войдите в кабинет, чтобы применить персональный промокод');

  const { data: promoCode, error: promoCodeError } = await supabase
    .from('promo_codes')
    .select('id,code,title,discount_type,discount_value,is_active,starts_at,expires_at,max_uses,applies_to')
    .ilike('code', code)
    .in('applies_to', ['training', 'all'])
    .maybeSingle();

  if (promoCodeError) throw promoCodeError;
  if (!promoCode || promoCode.is_active === false) {
    throw new Error('Промокод для обучения не найден или выключен');
  }

  const now = Date.now();
  if (promoCode.starts_at && new Date(promoCode.starts_at).getTime() > now) {
    throw new Error('Промокод ещё не начал действовать');
  }
  if (promoCode.expires_at && new Date(promoCode.expires_at).getTime() < now) {
    throw new Error('Срок действия промокода истёк');
  }

  const { data: ownRedemptions, error: ownRedemptionsError } = await supabase
    .from('promo_code_redemptions')
    .select('id')
    .eq('promo_code_id', promoCode.id)
    .eq('user_id', userId)
    .limit(1);

  if (ownRedemptionsError) throw ownRedemptionsError;
  if ((ownRedemptions || []).length > 0) {
    throw new Error('Этот промокод уже был использован в вашем кабинете');
  }

  if (promoCode.max_uses) {
    const { count, error: countError } = await supabase
      .from('promo_code_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('promo_code_id', promoCode.id);

    if (countError) throw countError;
    if ((count || 0) >= Number(promoCode.max_uses)) {
      throw new Error('Лимит использований промокода исчерпан');
    }
  }

  const discount = calculateTrainingPromoDiscount(originalPrice, promoCode);
  if (discount <= 0) throw new Error('Промокод не уменьшает стоимость обучения');

  return {
    id: promoCode.id,
    code: promoCode.code,
    title: promoCode.title,
    discount,
    finalPrice: Math.max(0, originalPrice - discount),
    originalPrice,
  };
};
