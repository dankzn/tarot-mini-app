import {
  getSupabaseUserClient,
  readJsonBody,
} from './_auth.js';

const json = (response, status, payload) => response.status(status).json(payload);
const DEFAULT_TBANK_API_URL = 'https://securepay.tinkoff.ru/v2/Init';

const getAuthToken = (request) => {
  const header = request.headers.authorization || request.headers.Authorization || '';
  return header.replace(/^Bearer\s+/i, '').trim();
};

const assertAdmin = async (token) => {
  if (!token) return false;

  const supabase = getSupabaseUserClient(token);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) return false;

  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (error) {
    console.error('T-Bank admin check failed:', error);
    return false;
  }

  return Boolean(data);
};

const getSettings = async (supabase) => {
  const { data, error } = await supabase.rpc('get_tbank_provider_settings_admin_rpc');

  if (error) return { ok: false, error: error.message, code: error.code, details: error.details };

  const settings = Array.isArray(data) ? data[0] : data;
  return { ok: true, settings: settings || null };
};

export default async function handler(request, response) {
  const token = getAuthToken(request);
  const isAdmin = await assertAdmin(token);

  if (!isAdmin) {
    return json(response, 403, {
      ok: false,
      error: 'Admin access is required',
      code: 'ADMIN_REQUIRED',
    });
  }

  const supabase = getSupabaseUserClient(token);

  if (request.method === 'GET') {
    const result = await getSettings(supabase);
    if (!result.ok) return json(response, 500, result);

    const settings = result.settings || {};
    return json(response, 200, {
      ok: true,
      settings: {
        is_active: Boolean(settings.is_active),
        terminal_key: settings.terminal_key || '',
        has_password: Boolean(settings.has_password),
        api_url: settings.api_url || DEFAULT_TBANK_API_URL,
        success_url: settings.success_url || '',
        fail_url: settings.fail_url || '',
        notification_url: settings.notification_url || '',
        updated_at: settings.updated_at || null,
      },
    });
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return json(response, 405, { ok: false, error: 'Method not allowed' });
  }

  const body = await readJsonBody(request);

  const settingsPayload = {
    is_active: Boolean(body.is_active),
    terminal_key: String(body.terminal_key || '').trim(),
    terminal_password: String(body.terminal_password || ''),
    api_url: String(body.api_url || '').trim() || DEFAULT_TBANK_API_URL,
    success_url: String(body.success_url || '').trim() || null,
    fail_url: String(body.fail_url || '').trim() || null,
    notification_url: String(body.notification_url || '').trim() || null,
  };

  let { error } = await supabase.rpc('upsert_tbank_provider_settings_admin_json_rpc', {
    p_settings: settingsPayload,
  });

  if (error?.code === 'PGRST202') {
    const fallback = await supabase.rpc('upsert_tbank_provider_settings_admin_rpc', {
      p_is_active: settingsPayload.is_active,
      p_terminal_key: settingsPayload.terminal_key,
      p_terminal_password: settingsPayload.terminal_password,
      p_api_url: settingsPayload.api_url,
      p_success_url: settingsPayload.success_url,
      p_fail_url: settingsPayload.fail_url,
      p_notification_url: settingsPayload.notification_url,
    });
    error = fallback.error;
  }

  if (error) {
    return json(response, 400, {
      ok: false,
      error: error.message || 'Не удалось сохранить настройки Т-Банка',
      code: error.code || null,
      details: error.details || null,
      hint: error.hint || null,
    });
  }

  const result = await getSettings(supabase);
  if (!result.ok) return json(response, 500, result);

  const settings = result.settings || {};
  return json(response, 200, {
    ok: true,
    settings: {
      is_active: Boolean(settings.is_active),
      terminal_key: settings.terminal_key || '',
      has_password: Boolean(settings.has_password),
      api_url: settings.api_url || DEFAULT_TBANK_API_URL,
      success_url: settings.success_url || '',
      fail_url: settings.fail_url || '',
      notification_url: settings.notification_url || '',
      updated_at: settings.updated_at || null,
    },
  });
}
