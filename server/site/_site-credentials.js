import { getSiteCredentialsSecret, hashPassword } from './_auth.js';

const buildCredentialsError = (error) => {
  const wrapped = new Error(`SITE_CREDENTIALS_SAVE_FAILED: ${error?.message || error?.code || 'unknown error'}`);
  wrapped.code = error?.code || null;
  wrapped.details = error?.details || null;
  wrapped.hint = error?.hint || null;
  return wrapped;
};

const isRlsCredentialsError = (error) =>
  /row-level security|RLS|permission denied|42501/i.test(
    String(error?.message || error?.code || error || ''),
  );

export const saveSitePassword = async (supabase, userId, password, { required = true } = {}) => {
  const passwordHash = hashPassword(password);
  const { error: credentialsError } = await supabase
    .from('site_auth_credentials')
    .upsert(
      {
        user_id: userId,
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (!credentialsError) return { ok: true, source: 'table' };

  const secret = getSiteCredentialsSecret();
  if (secret && isRlsCredentialsError(credentialsError)) {
    const { error: rpcError } = await supabase.rpc('upsert_site_auth_credentials_rpc', {
      p_secret: secret,
      p_user_id: userId,
      p_password_hash: passwordHash,
    });

    if (!rpcError) return { ok: true, source: 'rpc' };
    const error = buildCredentialsError(rpcError);
    if (!required) return { ok: false, error: error.message, code: error.code, details: error.details, hint: error.hint };
    throw error;
  }

  const error = buildCredentialsError(credentialsError);
  if (!required) return { ok: false, error: error.message, code: error.code, details: error.details, hint: error.hint };
  throw error;
};

export const getSitePasswordHash = async (supabase, userId) => {
  const { data: credentials, error: credentialsError } = await supabase
    .from('site_auth_credentials')
    .select('password_hash')
    .eq('user_id', userId)
    .maybeSingle();

  if (!credentialsError) {
    return { ok: true, passwordHash: credentials?.password_hash || null, source: 'table' };
  }

  const secret = getSiteCredentialsSecret();
  if (secret && isRlsCredentialsError(credentialsError)) {
    const { data: rpcCredentials, error: rpcError } = await supabase.rpc('get_site_auth_credentials_rpc', {
      p_secret: secret,
      p_user_id: userId,
    });

    if (!rpcError) {
      const row = Array.isArray(rpcCredentials) ? rpcCredentials[0] : rpcCredentials;
      return { ok: true, passwordHash: row?.password_hash || null, source: 'rpc' };
    }

    return { ok: false, passwordHash: null, error: rpcError.message || String(rpcError), source: 'rpc' };
  }

  return {
    ok: false,
    passwordHash: null,
    error: credentialsError.message || String(credentialsError),
    source: 'table',
  };
};
