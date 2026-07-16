import { getSupabaseAdmin } from './_auth.js';

const SERVICE_FIELDS = [
  'id',
  'title',
  'description',
  'short_description',
  'price',
  'duration_minutes',
  'category',
  'category_id',
  'display_badge',
  'request_tags',
  'next_price',
  'price_increase_at',
  'promo_title',
  'promo_price',
  'promo_starts_at',
  'promo_ends_at',
  'is_active',
  'sort_order',
].join(',');

const PUBLIC_SERVICE_FIELDS = [
  'id',
  'title',
  'description',
  'short_description',
  'price',
  'duration_minutes',
  'category',
  'next_price',
  'price_increase_at',
  'promo_title',
  'promo_price',
  'promo_starts_at',
  'promo_ends_at',
  'sort_order',
].join(',');

const getServiceOrder = (service) => Number(service?.sort_order || 0);
const getServicePrice = (service) => Number(service?.price || service?.promo_price || 0);

const sortServices = (services) =>
  services.sort((left, right) => getServiceOrder(left) - getServiceOrder(right) || getServicePrice(left) - getServicePrice(right));

const normalizeServices = (services) => {
  const payableServices = (services || [])
    .filter((service) => service?.title && getServicePrice(service) > 0);
  const activeServices = payableServices.filter((service) => service?.is_active !== false);

  return sortServices(activeServices.length > 0 ? activeServices : payableServices);
};

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('services')
    .select(SERVICE_FIELDS)
    .order('sort_order', { ascending: true })
    .order('price', { ascending: true });

  let { data, error } = await query;

  if (error) {
    const fallback = await supabase
      .from('services')
      .select(PUBLIC_SERVICE_FIELDS)
      .order('price', { ascending: true });

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return response.status(500).json({
      ok: false,
      error: error.message || 'Не удалось загрузить услуги',
      code: error.code || null,
      details: error.details || null,
    });
  }

  return response.status(200).json({
    ok: true,
    services: normalizeServices(data),
  });
}
