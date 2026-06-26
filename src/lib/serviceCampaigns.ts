export interface ServiceCampaignFields {
  price: number;
  next_price?: number | null;
  price_increase_at?: string | null;
  promo_title?: string | null;
  promo_price?: number | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
}

export interface ServicePriceState {
  currentPrice: number;
  basePrice: number;
  nextPrice: number | null;
  priceIncreaseAt: Date | null;
  isPromoActive: boolean;
  promoTitle: string | null;
  promoEndsAt: Date | null;
  countdownTarget: Date | null;
  countdownLabel: string | null;
}

const parseDate = (value?: string | null) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getServicePriceState = (
  service: ServiceCampaignFields,
  now = new Date()
): ServicePriceState => {
  const basePrice = service.price || 0;
  const nextPrice = service.next_price && service.next_price > 0 ? service.next_price : null;
  const priceIncreaseAt = parseDate(service.price_increase_at);
  const promoStartsAt = parseDate(service.promo_starts_at);
  const promoEndsAt = parseDate(service.promo_ends_at);
  const promoPrice = service.promo_price && service.promo_price > 0 ? service.promo_price : null;
  const hasPromoStarted = !promoStartsAt || promoStartsAt.getTime() <= now.getTime();
  const hasPromoEnded = Boolean(promoEndsAt && promoEndsAt.getTime() <= now.getTime());
  const isPromoActive = Boolean(promoPrice && hasPromoStarted && !hasPromoEnded);
  const isPriceIncreaseDue = Boolean(priceIncreaseAt && priceIncreaseAt.getTime() <= now.getTime());
  const currentPrice = isPromoActive ? promoPrice! : isPriceIncreaseDue && nextPrice ? nextPrice : basePrice;

  if (isPromoActive && promoEndsAt) {
    return {
      currentPrice,
      basePrice,
      nextPrice,
      priceIncreaseAt,
      isPromoActive,
      promoTitle: service.promo_title || 'Акция',
      promoEndsAt,
      countdownTarget: promoEndsAt,
      countdownLabel: 'До конца акции',
    };
  }

  if (!isPriceIncreaseDue && nextPrice && priceIncreaseAt) {
    return {
      currentPrice,
      basePrice,
      nextPrice,
      priceIncreaseAt,
      isPromoActive,
      promoTitle: null,
      promoEndsAt,
      countdownTarget: priceIncreaseAt,
      countdownLabel: 'До смены цены',
    };
  }

  return {
    currentPrice,
    basePrice,
    nextPrice,
    priceIncreaseAt,
    isPromoActive,
    promoTitle: isPromoActive ? service.promo_title || 'Акция' : null,
    promoEndsAt,
    countdownTarget: null,
    countdownLabel: null,
  };
};

export const formatCountdown = (target: Date | null, now = new Date()) => {
  if (!target) return null;

  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return 'уже скоро';

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${Math.max(minutes, 1)} мин`;
};
