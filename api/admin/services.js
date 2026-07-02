import { createClient } from '@supabase/supabase-js';

const fallbackSupabaseUrl = 'https://hhcexivlaqjeuvnzeqnn.supabase.co';
const fallbackSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoY2V4aXZsYXFqZXV2bnplcW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDI1MTAsImV4cCI6MjA5NjgxODUxMH0.nVwKyd_BITZ9SU4LQHXkb89ndUM7O_DGd6ESJx282B0';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

const parseBody = (body) => {
  if (!body || typeof body !== 'string') {
    return body || {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

const getAuthToken = (request) => {
  const header = request.headers.authorization || request.headers.Authorization || '';
  return header.replace(/^Bearer\s+/i, '').trim();
};

const getBasePayload = (payload = {}) => ({
  ...(typeof payload.title === 'string' ? { title: payload.title } : {}),
  ...(typeof payload.description === 'string' ? { description: payload.description } : {}),
  ...(Number.isFinite(Number(payload.price)) ? { price: Number(payload.price) } : {}),
  ...(Number.isFinite(Number(payload.duration_minutes)) ? { duration_minutes: Number(payload.duration_minutes) } : {}),
  ...(payload.next_price === null || Number.isFinite(Number(payload.next_price)) ? { next_price: payload.next_price === null ? null : Number(payload.next_price) } : {}),
  ...(typeof payload.price_increase_at === 'string' || payload.price_increase_at === null ? { price_increase_at: payload.price_increase_at } : {}),
  ...(typeof payload.promo_title === 'string' || payload.promo_title === null ? { promo_title: payload.promo_title } : {}),
  ...(payload.promo_price === null || Number.isFinite(Number(payload.promo_price)) ? { promo_price: payload.promo_price === null ? null : Number(payload.promo_price) } : {}),
  ...(typeof payload.promo_starts_at === 'string' || payload.promo_starts_at === null ? { promo_starts_at: payload.promo_starts_at } : {}),
  ...(typeof payload.promo_ends_at === 'string' || payload.promo_ends_at === null ? { promo_ends_at: payload.promo_ends_at } : {}),
});

const getFullPayload = (payload = {}) => ({
  ...getBasePayload(payload),
  ...(typeof payload.category_id === 'string' || payload.category_id === null ? { category_id: payload.category_id } : {}),
  ...(typeof payload.display_badge === 'string' || payload.display_badge === null ? { display_badge: payload.display_badge } : {}),
  ...(Array.isArray(payload.request_tags) ? { request_tags: payload.request_tags.filter(tag => typeof tag === 'string').slice(0, 20) } : {}),
  ...(typeof payload.short_description === 'string' || payload.short_description === null ? { short_description: payload.short_description } : {}),
  ...(Number.isFinite(Number(payload.sort_order)) ? { sort_order: Number(payload.sort_order) } : {}),
});

const assertAdmin = async (supabase) => {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user?.id) {
    return false;
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (error) {
    console.error('Admin verification failed:', error);
    return false;
  }

  return Boolean(data);
};

const saveService = async ({ supabase, action, id, payload }) => {
  if (action === 'update') {
    if (!id) throw new Error('Service id is required');

    return supabase
      .from('services')
      .update(payload)
      .eq('id', id)
      .select();
  }

  if (action === 'insert') {
    return supabase
      .from('services')
      .insert([payload])
      .select();
  }

  throw new Error('Unsupported service action');
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = getAuthToken(request);

  if (!token) {
    response.status(401).json({ error: 'Admin auth token is required' });
    return;
  }

  const { action, id, payload } = parseBody(request.body);

  if (!payload || typeof payload !== 'object') {
    response.status(400).json({ error: 'Service payload is required' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  try {
    const isAdmin = await assertAdmin(supabase);

    if (!isAdmin) {
      response.status(403).json({ error: 'Admin access is required' });
      return;
    }

    let result = await saveService({ supabase, action, id, payload: getFullPayload(payload) });
    let mode = 'full';

    if (result.error) {
      const fallbackResult = await saveService({
        supabase,
        action,
        id,
        payload: getBasePayload(payload),
      });

      result = fallbackResult;
      mode = 'base';
    }

    if (result.error) {
      response.status(400).json({ error: result.error.message, mode });
      return;
    }

    response.status(200).json({ ok: true, data: result.data, mode });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to save service',
    });
  }
}
