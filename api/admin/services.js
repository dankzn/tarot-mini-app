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
  title: payload.title,
  description: payload.description,
  price: payload.price,
  duration_minutes: payload.duration_minutes,
  next_price: payload.next_price,
  price_increase_at: payload.price_increase_at,
  promo_title: payload.promo_title,
  promo_price: payload.promo_price,
  promo_starts_at: payload.promo_starts_at,
  promo_ends_at: payload.promo_ends_at,
});

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
    let result = await saveService({ supabase, action, id, payload });
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
