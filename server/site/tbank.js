import crypto from 'crypto';
import https from 'https';
import { getSiteUrl, getSupabaseAdmin, readJsonBody, readSession, verifyTelegramWebAppInitData } from './_auth.js';
import { notifyAdminsPaymentEvent, notifyClientPaymentSucceeded } from './_telegram-notify.js';

const TBANK_INIT_URL = 'https://securepay.tinkoff.ru/v2/Init';
const TBANK_LEGACY_TEST_INIT_URLS = new Set([
  'https://rest-api-test.tinkoff.ru/v2/Init',
  'https://rest-api-test.tbank.ru/v2/Init',
]);
const TBANK_REQUEST_TIMEOUT_MS = 15000;

const json = (response, status, payload) => response.status(status).json(payload);

const normalizeTbankUrl = (value) => {
  const rawUrl = String(value || '').trim();
  const url = TBANK_LEGACY_TEST_INIT_URLS.has(rawUrl) ? TBANK_INIT_URL : rawUrl || TBANK_INIT_URL;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      const error = new Error('Адрес API Т-Банка должен начинаться с https://');
      error.code = 'TBANK_API_URL_INVALID';
      throw error;
    }
    return parsed.toString();
  } catch (error) {
    if (error?.code === 'TBANK_API_URL_INVALID') throw error;
    const invalidUrlError = new Error('Некорректный API URL Т-Банка в настройках оплаты');
    invalidUrlError.code = 'TBANK_API_URL_INVALID';
    invalidUrlError.details = { apiUrl: rawUrl || null };
    throw invalidUrlError;
  }
};

const getSafeUrlDetails = (value) => {
  try {
    const url = new URL(value);
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.host,
      path: url.pathname,
    };
  } catch {
    return null;
  }
};

const getNetworkErrorDetails = (error) => {
  const cause = error?.cause || {};
  return {
    message: error?.message || String(error),
    code: error?.code || cause?.code || null,
    causeMessage: cause?.message || null,
    causeCode: cause?.code || null,
    errno: cause?.errno || null,
    syscall: cause?.syscall || null,
    hostname: cause?.hostname || null,
  };
};

const isTbankTestInitUrl = (value) => {
  try {
    const url = new URL(value);
    return url.hostname === 'rest-api-test.tinkoff.ru' || url.hostname === 'rest-api-test.tbank.ru';
  } catch {
    return false;
  }
};

const stripHtml = (value) => String(value || '')
  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getNonJsonBankMessage = (rawText, bankResponse) => {
  const text = String(rawText || '').trim();
  const plainText = stripHtml(text);
  const status = bankResponse?.statusCode || null;
  const statusText = bankResponse?.statusMessage || '';

  if (text.startsWith('<')) {
    const statusLabel = [status, statusText].filter(Boolean).join(' ');
    return {
      message: 'Т-Банк вернул HTML вместо JSON',
      details: status === 403
        ? 'API URL Т-Банка вернул 403 Forbidden. Проверьте, что в настройках указан https://securepay.tinkoff.ru/v2/Init'
        : `${statusLabel || 'HTTP-ответ'}: ${plainText || 'HTML без текста'}`,
    };
  }

  return {
    message: 'Т-Банк вернул ответ не в JSON',
    details: plainText.slice(0, 500) || 'Пустой ответ банка',
  };
};

const readBankResponseBody = (bankResponse) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    bankResponse.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    bankResponse.on('error', reject);
    bankResponse.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

const parseBankPayload = (rawText, bankResponse) => {
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch {
    const nonJsonMessage = getNonJsonBankMessage(rawText, bankResponse);
    return {
      Success: false,
      ErrorCode: bankResponse?.statusCode ? String(bankResponse.statusCode) : 'NON_JSON_RESPONSE',
      Message: nonJsonMessage.message,
      Details: nonJsonMessage.details,
    };
  }
};

const requestTbankJson = (initUrl, payload) =>
  new Promise((resolve, reject) => {
    const url = new URL(initUrl);
    const body = JSON.stringify(payload);
    const request = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        rejectUnauthorized: !isTbankTestInitUrl(initUrl),
        timeout: TBANK_REQUEST_TIMEOUT_MS,
      },
      async (bankResponse) => {
        try {
          const rawText = await readBankResponseBody(bankResponse);
          resolve({
            bankResponse: {
              ok: bankResponse.statusCode >= 200 && bankResponse.statusCode < 300,
              status: bankResponse.statusCode,
              statusText: bankResponse.statusMessage || '',
            },
            bankPayload: parseBankPayload(rawText, bankResponse),
          });
        } catch (error) {
          reject(error);
        }
      },
    );

    request.on('timeout', () => {
      const timeoutError = new Error('Т-Банк не ответил за 15 секунд');
      timeoutError.code = 'TBANK_TIMEOUT';
      request.destroy(timeoutError);
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });

const postTbankInit = async (initUrl, payload) => {
  const normalizedUrl = normalizeTbankUrl(initUrl);

  try {
    const result = await requestTbankJson(normalizedUrl, payload);
    return { ...result, initUrl: normalizedUrl };
  } catch (error) {
    const details = getNetworkErrorDetails(error);
    const timeoutText = error?.code === 'TBANK_TIMEOUT' ? 'Т-Банк не ответил за 15 секунд' : 'Не удалось подключиться к API Т-Банка';
    const networkError = new Error(`${timeoutText}: ${details.causeCode || details.code || details.causeMessage || details.message}`);
    networkError.code = 'TBANK_FETCH_FAILED';
    networkError.details = {
      api: getSafeUrlDetails(normalizedUrl),
      tls: isTbankTestInitUrl(normalizedUrl) ? 'relaxed_for_tbank_test_endpoint' : 'strict',
      network: details,
    };
    throw networkError;
  }
};

const getTbankMethodUrl = (baseUrl, method) => {
  const url = new URL(normalizeTbankUrl(baseUrl));
  const cleanMethod = String(method || '').replace(/^\/+/, '');
  url.pathname = url.pathname.replace(/\/v2\/[^/]*$/i, `/v2/${cleanMethod}`);
  if (!/\/v2\//i.test(url.pathname)) {
    url.pathname = `/v2/${cleanMethod}`;
  }
  return url.toString();
};

const postTbankMethod = async (baseUrl, method, payload) => {
  const methodUrl = getTbankMethodUrl(baseUrl, method);
  const result = await requestTbankJson(methodUrl, payload);
  return { ...result, methodUrl };
};

const readTbankBody = async (request) => {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') {
    const raw = request.body.trim();
    if (!raw) return {};
    if (raw.startsWith('{')) return JSON.parse(raw);
    return Object.fromEntries(new URLSearchParams(raw));
  }

  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  if (raw.startsWith('{')) return JSON.parse(raw);
  return Object.fromEntries(new URLSearchParams(raw));
};

const normalizeCartItem = (item) => {
  const rawId = String(item?.id || '').trim();
  const rawSource = String(item?.source || '').trim();
  const [sourceFromId, idFromId] = rawId.includes(':') ? rawId.split(':') : ['', rawId];
  const source = rawSource || sourceFromId;
  const id = idFromId || rawId;
  const promoCode = String(item?.promoCode || item?.promo_code || '').trim().replace(/\s+/g, '').toUpperCase();

  if (!['service', 'consultation', 'training'].includes(source) || !id) return null;
  return { source, id, rawId, promoCode };
};

const calculateTrainingPromoDiscount = (price, promoCode) => {
  const basePrice = Math.max(0, Math.round(Number(price || 0)));
  const rawDiscount = promoCode.discount_type === 'percent'
    ? Math.round(basePrice * Number(promoCode.discount_value || 0) / 100)
    : Math.round(Number(promoCode.discount_value || 0));

  return Math.min(basePrice, Math.max(0, rawDiscount));
};

const validateTrainingPromoCode = async (supabase, userId, rawCode, price) => {
  const code = String(rawCode || '').trim().replace(/\s+/g, '').toUpperCase();
  if (!code) return null;

  const { data: promoCode, error: promoCodeError } = await supabase
    .from('promo_codes')
    .select('id,code,title,discount_type,discount_value,is_active,starts_at,expires_at,max_uses,applies_to')
    .ilike('code', code)
    .in('applies_to', ['training', 'all'])
    .maybeSingle();

  if (promoCodeError) throw promoCodeError;
  if (!promoCode || promoCode.is_active === false) throw new Error('TRAINING_PROMO_NOT_FOUND');

  const now = Date.now();
  if (promoCode.starts_at && new Date(promoCode.starts_at).getTime() > now) throw new Error('TRAINING_PROMO_NOT_STARTED');
  if (promoCode.expires_at && new Date(promoCode.expires_at).getTime() < now) throw new Error('TRAINING_PROMO_EXPIRED');

  const { data: ownRedemptions, error: ownRedemptionsError } = await supabase
    .from('promo_code_redemptions')
    .select('id')
    .eq('promo_code_id', promoCode.id)
    .eq('user_id', userId)
    .limit(1);

  if (ownRedemptionsError) throw ownRedemptionsError;
  if ((ownRedemptions || []).length > 0) throw new Error('TRAINING_PROMO_ALREADY_USED');

  if (promoCode.max_uses) {
    const { count, error: countError } = await supabase
      .from('promo_code_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('promo_code_id', promoCode.id);

    if (countError) throw countError;
    if ((count || 0) >= Number(promoCode.max_uses)) throw new Error('TRAINING_PROMO_LIMIT_REACHED');
  }

  const originalPrice = Math.max(0, Math.round(Number(price || 0)));
  const discount = calculateTrainingPromoDiscount(originalPrice, promoCode);
  if (discount <= 0) throw new Error('TRAINING_PROMO_EMPTY_DISCOUNT');

  return {
    promoCode,
    originalPrice,
    discount,
    finalPrice: Math.max(0, originalPrice - discount),
  };
};

const buildToken = (payload, password) => {
  const tokenPayload = {
    ...payload,
    Password: password,
  };

  return crypto
    .createHash('sha256')
    .update(
      Object.keys(tokenPayload)
        .filter((key) => key !== 'Token' && tokenPayload[key] !== undefined && tokenPayload[key] !== null && typeof tokenPayload[key] !== 'object')
        .sort()
        .map((key) => String(tokenPayload[key]))
        .join(''),
    )
    .digest('hex');
};

const getTbankSettingsFromDb = async (supabase) => {
  const { data, error } = await supabase.rpc('get_tbank_runtime_settings_rpc');

  if (error) {
    console.warn('T-Bank settings RPC failed:', error.message || error);
    return null;
  }

  const settings = Array.isArray(data) ? data[0] : data;
  if (!settings?.is_active) return null;
  return settings;
};

const signTbankPayload = async (supabase, payload, fallbackPassword = '') => {
  if (fallbackPassword) return buildToken(payload, fallbackPassword);

  const { data, error } = await supabase.rpc('sign_tbank_payload_rpc', {
    p_payload: payload,
  });

  if (error || !data) {
    throw new Error(`TBANK_TOKEN_SIGN_FAILED: ${error?.message || 'empty token'}`);
  }

  return data;
};

const verifyTbankPayloadToken = async (supabase, payload, fallbackPassword = '') => {
  if (fallbackPassword) {
    const incomingToken = String(payload.Token || '');
    const calculatedToken = buildToken(payload, fallbackPassword);
    return (
      incomingToken &&
      incomingToken.length === calculatedToken.length &&
      crypto.timingSafeEqual(Buffer.from(incomingToken), Buffer.from(calculatedToken))
    );
  }

  const { data, error } = await supabase.rpc('verify_tbank_payload_token_rpc', {
    p_payload: payload,
  });

  if (error) {
    console.warn('T-Bank token verification RPC failed:', error.message || error);
    return false;
  }

  return data === true;
};

const getTbankConfig = async (request, supabase) => {
  const terminalKey = process.env.TBANK_TERMINAL_KEY || process.env.TINKOFF_TERMINAL_KEY || '';
  const password = process.env.TBANK_PASSWORD || process.env.TINKOFF_PASSWORD || '';
  const dbSettings = terminalKey && password ? null : await getTbankSettingsFromDb(supabase);
  const siteUrl = getSiteUrl(request);

  return {
    terminalKey: terminalKey || dbSettings?.terminal_key || '',
    password: password || dbSettings?.terminal_password || '',
    canSignRemotely: Boolean(dbSettings?.has_password),
    initUrl: process.env.TBANK_API_URL || process.env.TINKOFF_API_URL || dbSettings?.api_url || TBANK_INIT_URL,
    successUrl: process.env.TBANK_SUCCESS_URL || dbSettings?.success_url || `${siteUrl}/site/payment?payment=success`,
    failUrl: process.env.TBANK_FAIL_URL || dbSettings?.fail_url || `${siteUrl}/site/payment?payment=failed`,
    notificationUrl: process.env.TBANK_NOTIFICATION_URL || dbSettings?.notification_url || `${siteUrl}/api/site/tbank-notification`,
  };
};

const withQueryParam = (url, key, value) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

const getCurrentServicePrice = (service) => {
  const now = Date.now();
  const basePrice = Number(service?.price || 0);
  const nextPrice = Number(service?.next_price || 0);
  const promoPrice = Number(service?.promo_price || 0);
  const priceIncreaseAt = parseDate(service?.price_increase_at);
  const promoStartsAt = parseDate(service?.promo_starts_at);
  const promoEndsAt = parseDate(service?.promo_ends_at);
  const promoStarted = !promoStartsAt || promoStartsAt.getTime() <= now;
  const promoActive = promoPrice > 0 && promoStarted && (!promoEndsAt || promoEndsAt.getTime() > now);

  if (promoActive) return promoPrice;
  if (nextPrice > 0 && priceIncreaseAt && priceIncreaseAt.getTime() <= now) return nextPrice;
  return basePrice;
};

const getServicePosition = async (supabase, item) => {
  const { data, error } = await supabase
    .from('services')
    .select('id,title,price,next_price,price_increase_at,promo_price,promo_starts_at,promo_ends_at')
    .eq('id', item.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('SERVICE_NOT_FOUND');

  return {
    source: 'service',
    source_id: data.id,
    title: data.title || 'Услуга',
    amount: getCurrentServicePrice(data),
  };
};

const getConsultationPosition = async (supabase, item, userId) => {
  const { data, error } = await supabase
    .from('consultations')
    .select('id,user_id,status,payment_status,payment_amount,price,services(title)')
    .eq('id', item.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('CONSULTATION_NOT_FOUND');
  if (['paid', 'confirmed', 'completed'].includes(String(data.payment_status || '').toLowerCase())) {
    throw new Error('CONSULTATION_ALREADY_PAID');
  }

  const service = Array.isArray(data.services) ? data.services[0] : data.services;
  return {
    source: 'consultation',
    source_id: data.id,
    title: service?.title || 'Консультация',
    amount: Number(data.payment_amount ?? data.price ?? 0),
  };
};

const getTrainingPosition = async (supabase, item, userId) => {
  if (!isUuid(item.id)) {
    return getTrainingProgramPosition(supabase, item, userId);
  }

  const { data, error } = await supabase
    .from('training_enrollments')
    .select('id,user_id,status,payment_status,final_price,original_price,promo_code_id,promo_code,promo_discount,training_programs(title,price)')
    .eq('id', item.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return getTrainingProgramPosition(supabase, item, userId);
  if (['paid', 'confirmed', 'completed'].includes(String(data.payment_status || '').toLowerCase())) {
    throw new Error('TRAINING_ALREADY_PAID');
  }

  const program = Array.isArray(data.training_programs) ? data.training_programs[0] : data.training_programs;
  const appliedPromo = await validateTrainingPromoCode(supabase, userId, item.promoCode, Number(program?.price || data.original_price || data.final_price || 0));
  let enrollment = data;

  if (appliedPromo) {
    const { data: updatedEnrollment, error: updateError } = await supabase
      .from('training_enrollments')
      .update({
        original_price: appliedPromo.originalPrice,
        final_price: appliedPromo.finalPrice,
        promo_code_id: appliedPromo.promoCode.id,
        promo_code: appliedPromo.promoCode.code,
        promo_discount: appliedPromo.discount,
      })
      .eq('id', data.id)
      .select('id,user_id,status,payment_status,final_price,original_price,promo_code_id,promo_code,promo_discount')
      .single();

    if (updateError) throw updateError;
    enrollment = { ...data, ...updatedEnrollment };
  }

  return {
    source: 'training',
    source_id: enrollment.id,
    user_id: enrollment.user_id,
    title: program?.title || 'Обучение Таро',
    amount: Number(enrollment.final_price ?? program?.price ?? 0),
    original_price: Number(enrollment.original_price || program?.price || enrollment.final_price || 0),
    promo_code_id: enrollment.promo_code_id || null,
    promo_code: enrollment.promo_code || null,
    promo_discount: Number(enrollment.promo_discount || 0),
  };
};

const getTrainingProgramPosition = async (supabase, item, userId) => {
  let program = null;

  if (isUuid(item.id)) {
    const { data: programById, error: programByIdError } = await supabase
      .from('training_programs')
      .select('id,slug,title,price,is_active')
      .eq('is_active', true)
      .eq('id', item.id)
      .maybeSingle();

    if (programByIdError) throw programByIdError;
    program = programById;
  }

  if (!program) {
    const { data: programBySlug, error: programBySlugError } = await supabase
      .from('training_programs')
      .select('id,slug,title,price,is_active')
      .eq('is_active', true)
      .eq('slug', item.id)
      .maybeSingle();

    if (programBySlugError) throw programBySlugError;
    program = programBySlug;
  }

  if (!program) throw new Error('TRAINING_PROGRAM_NOT_FOUND');

  const { data: existingEnrollment, error: existingEnrollmentError } = await supabase
    .from('training_enrollments')
    .select('id,user_id,status,payment_status,final_price,original_price,promo_code_id,promo_code,promo_discount')
    .eq('user_id', userId)
    .eq('program_id', program.id)
    .not('status', 'in', '(cancelled,expelled,completed)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingEnrollmentError) throw existingEnrollmentError;
  if (existingEnrollment && ['paid', 'confirmed', 'completed'].includes(String(existingEnrollment.payment_status || '').toLowerCase())) {
    throw new Error('TRAINING_ALREADY_PAID');
  }

  let enrollment = existingEnrollment;
  const appliedPromo = await validateTrainingPromoCode(supabase, userId, item.promoCode, Number(program.price || 0));

  if (!enrollment) {
    const { data: createdEnrollment, error: createdEnrollmentError } = await supabase
      .from('training_enrollments')
      .insert({
        user_id: userId,
        program_id: program.id,
        status: 'pending',
        payment_status: 'not_requested',
        original_price: Number(program.price || 0),
        final_price: appliedPromo?.finalPrice ?? Number(program.price || 0),
        promo_code_id: appliedPromo?.promoCode.id || null,
        promo_code: appliedPromo?.promoCode.code || null,
        promo_discount: appliedPromo?.discount || 0,
      })
      .select('id,user_id,status,payment_status,final_price,original_price,promo_code_id,promo_code,promo_discount')
      .single();

    if (createdEnrollmentError) throw createdEnrollmentError;
    enrollment = createdEnrollment;
  } else if (appliedPromo) {
    const { data: updatedEnrollment, error: updateEnrollmentError } = await supabase
      .from('training_enrollments')
      .update({
        original_price: appliedPromo.originalPrice,
        final_price: appliedPromo.finalPrice,
        promo_code_id: appliedPromo.promoCode.id,
        promo_code: appliedPromo.promoCode.code,
        promo_discount: appliedPromo.discount,
      })
      .eq('id', enrollment.id)
      .select('id,user_id,status,payment_status,final_price,original_price,promo_code_id,promo_code,promo_discount')
      .single();

    if (updateEnrollmentError) throw updateEnrollmentError;
    enrollment = updatedEnrollment;
  }

  return {
    source: 'training',
    source_id: enrollment.id,
    user_id: enrollment.user_id,
    title: program.title || 'Обучение Таро',
    amount: Number(enrollment.final_price || program.price || 0),
    original_price: Number(enrollment.original_price || program.price || enrollment.final_price || 0),
    promo_code_id: enrollment.promo_code_id || null,
    promo_code: enrollment.promo_code || null,
    promo_discount: Number(enrollment.promo_discount || 0),
  };
};

const getCartPositions = async (supabase, cartItems, userId) => {
  const positions = [];

  for (const item of cartItems) {
    let position = null;
    if (item.source === 'service') position = await getServicePosition(supabase, item);
    if (item.source === 'consultation') position = await getConsultationPosition(supabase, item, userId);
    if (item.source === 'training') position = await getTrainingPosition(supabase, item, userId);
    if (position) positions.push({ ...position, cart_id: item.rawId || `${item.source}:${item.id}` });
  }

  return positions.filter((item) => item.amount > 0);
};

const updateSourcePaymentStatus = async (supabase, positions, patch) => {
  const updates = await Promise.all(
    positions.map((item) => {
      if (item.source === 'consultation') {
        const consultationPatch = typeof patch.consultation === 'function' ? patch.consultation(item) : patch.consultation;
        return supabase.from('consultations').update(consultationPatch).eq('id', item.source_id);
      }
      if (item.source === 'training') {
        const trainingPatch = typeof patch.training === 'function' ? patch.training(item) : patch.training;
        return supabase.from('training_enrollments').update(trainingPatch).eq('id', item.source_id);
      }
      return Promise.resolve({ error: null });
    }),
  );

  const failedUpdate = updates.find((result) => result?.error);
  if (failedUpdate?.error) throw failedUpdate.error;
};

const redeemPaidTrainingPromos = async (supabase, cartItems) => {
  const rows = (Array.isArray(cartItems) ? cartItems : [])
    .filter((item) => item?.source === 'training' && item?.promo_code_id && item?.user_id && item?.source_id)
    .map((item) => ({
      promo_code_id: item.promo_code_id,
      user_id: item.user_id,
      training_enrollment_id: item.source_id,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('promo_code_redemptions')
    .upsert(rows, { onConflict: 'promo_code_id,user_id', ignoreDuplicates: true });

  if (error) throw error;
};


const getRequestQueryParam = (request, key) => {
  const queryValue = request.query?.[key];
  if (Array.isArray(queryValue)) return queryValue[0] || '';
  if (queryValue) return String(queryValue);

  const host = request.headers.host || 'localhost';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const url = new URL(request.url || '/', `${protocol}://${host}`);
  return url.searchParams.get(key) || '';
};

const getCartItemKey = (item) => {
  const cartId = String(item?.cart_id || '').trim();
  if (cartId) return cartId;

  const source = String(item?.source || '').trim();
  const sourceId = String(item?.source_id || item?.id || '').trim();
  if (!source || !sourceId) return '';
  return `${source}:${sourceId}`;
};

const resolvePaymentUser = async (request, supabase, body) => {
  const session = readSession(request);
  if (session?.id) return session;

  const telegramInitData = String(body?.telegramInitData || body?.telegram_init_data || '').trim();
  let telegramUserId = 0;

  if (telegramInitData) {
    const verification = verifyTelegramWebAppInitData(telegramInitData);
    if (verification.ok) {
      telegramUserId = verification.telegramUser.id;
    } else if (verification.error !== 'Telegram bot token is not configured') {
      const error = new Error(verification.error || 'Telegram authorization failed');
      error.code = 'TELEGRAM_AUTH_FAILED';
      throw error;
    }

    if (!telegramUserId) {
      const initParams = new URLSearchParams(telegramInitData);
      const rawTelegramUser = initParams.get('user');
      if (rawTelegramUser) {
        const parsedTelegramUser = JSON.parse(rawTelegramUser);
        telegramUserId = Number(parsedTelegramUser?.id || 0);
      }
    }
  }

  telegramUserId = telegramUserId || Number(body?.telegramUserId || body?.telegram_id || 0);
  const userId = String(body?.userId || body?.user_id || '').trim();

  if (!telegramUserId) return null;

  let query = supabase
    .from('users')
    .select('id, telegram_id, username, name, email')
    .eq('telegram_id', telegramUserId);

  if (userId) query = query.eq('id', userId);

  const { data: user, error } = await query.maybeSingle();

  if (error) throw error;
  if (!user?.id) {
    const notFoundError = new Error('Пользователь Telegram не найден');
    notFoundError.code = 'TELEGRAM_USER_NOT_FOUND';
    throw notFoundError;
  }

  return {
    id: user.id,
    telegram_id: user.telegram_id,
    username: user.username,
    name: user.name,
    email: user.email,
    source: 'telegram_mini_app',
  };
};

const getBankErrorMessage = (payload) => {
  const source = payload && typeof payload === 'object' ? payload : {};
  const details = String(source.Details || source.details || '').trim();
  const message = String(source.Message || source.message || '').trim();
  const status = String(source.Status || source.status || '').trim();
  const errorCode = String(source.ErrorCode || source.errorCode || source.Error || '').trim();

  if (details && message && details !== message) return `${message}: ${details}`;
  if (details) return details;
  if (message) return message;
  if (errorCode && errorCode !== '0') return `Код ошибки банка: ${errorCode}`;
  if (status) return `Статус платежа: ${status}`;
  return 'Банк не одобрил оплату';
};

const getTrainingPromoErrorMessage = (error) => {
  const code = error?.message || error?.code || '';
  const messages = {
    TRAINING_PROMO_NOT_FOUND: 'Промокод для обучения не найден или выключен',
    TRAINING_PROMO_NOT_STARTED: 'Промокод ещё не начал действовать',
    TRAINING_PROMO_EXPIRED: 'Срок действия промокода истёк',
    TRAINING_PROMO_ALREADY_USED: 'Этот промокод уже был использован в вашем кабинете',
    TRAINING_PROMO_LIMIT_REACHED: 'Лимит использований промокода исчерпан',
    TRAINING_PROMO_EMPTY_DISCOUNT: 'Промокод не уменьшает стоимость обучения',
  };

  return messages[code] || null;
};

const getBankStatusMessage = (attempt) => {
  const rawNotification = attempt?.raw_notification || {};
  const rawResponse = attempt?.raw_response || {};
  const status = String(rawNotification.Status || attempt?.status || '').toUpperCase();

  if (['AUTHORIZED', 'CONFIRMED', 'PAID'].includes(status) || attempt?.status === 'paid') {
    return {
      paymentState: 'paid',
      title: 'Оплата прошла',
      message: 'Платёж принят банком',
    };
  }

  if (['CANCELED', 'CANCELLED'].includes(status) || attempt?.status === 'canceled') {
    return {
      paymentState: 'failed',
      title: 'Платёж отменён',
      message: 'Ссылка оплаты отменена. Можно создать новый платёж',
      bankStatus: status || attempt?.status || null,
      bankCode: rawNotification.ErrorCode || rawResponse.ErrorCode || null,
    };
  }

  if (['REJECTED', 'DEADLINE_EXPIRED', 'FAILED'].includes(status) || attempt?.status === 'failed') {
    return {
      paymentState: 'failed',
      title: 'Оплата не прошла',
      message: getBankErrorMessage(rawNotification?.Status ? rawNotification : rawResponse),
      bankStatus: status || attempt?.status || null,
      bankCode: rawNotification.ErrorCode || rawResponse.ErrorCode || null,
    };
  }

  return {
    paymentState: 'processing',
    title: 'Платёж обрабатывается',
    message: 'Банк ещё не прислал финальный статус',
    bankStatus: status || attempt?.status || null,
  };
};

const getAttemptStatusPatch = (notification) => {
  const status = String(notification?.Status || '').toUpperCase();
  const isSuccess = notification?.Success === true || String(notification?.Success || '').toLowerCase() === 'true';
  const isPaid = isSuccess && ['AUTHORIZED', 'CONFIRMED', 'PAID'].includes(status);
  const isCanceled = ['CANCELED', 'CANCELLED'].includes(status);
  const isFailed = ['REJECTED', 'DEADLINE_EXPIRED', 'FAILED'].includes(status);

  return {
    status,
    isPaid,
    isFailed: isCanceled || isFailed,
    nextStatus: isPaid ? 'paid' : isCanceled ? 'canceled' : isFailed ? 'failed' : status.toLowerCase() || 'updated',
  };
};

const notifyPaymentTransition = async (supabase, previousAttempt, updatedAttempt, notification) => {
  const shouldNotifyAdmin = !previousAttempt || previousAttempt.status !== updatedAttempt.status;

  if (shouldNotifyAdmin) {
    const adminNotificationResult = await notifyAdminsPaymentEvent(supabase, updatedAttempt, notification).catch((error) => ({
      ok: false,
      error: error?.message || String(error),
    }));

    if (!adminNotificationResult.ok) {
      console.warn('Payment admin notification failed:', adminNotificationResult.error);
    }
  }

  if (updatedAttempt.status === 'paid' && previousAttempt?.status !== 'paid') {
    const clientNotificationResult = await notifyClientPaymentSucceeded(supabase, updatedAttempt).catch((error) => ({
      ok: false,
      error: error?.message || String(error),
    }));

    if (!clientNotificationResult.ok) {
      console.warn('Payment client notification failed:', clientNotificationResult.error);
    }
  }
};

const applyPaidSourceUpdates = async (supabase, cartItems) => {
  if (!cartItems) return;

  await updateSourcePaymentStatus(supabase, cartItems, {
    consultation: {
      payment_status: 'paid',
      payment_marked_at: new Date().toISOString(),
    },
    training: {
      payment_status: 'paid',
    },
  });
  await redeemPaidTrainingPromos(supabase, cartItems);
};

const applyCanceledSourceUpdates = async (supabase, cartItems) => {
  if (!cartItems) return;

  await updateSourcePaymentStatus(supabase, cartItems, {
    consultation: {
      payment_status: 'payment_requested',
    },
    training: {
      payment_status: 'requested',
    },
  });
};

const getCancelablePositionsFromCart = async (supabase, cartItems, userId) => {
  const positions = [];

  for (const item of cartItems) {
    if (item.source === 'consultation' && isUuid(item.id)) {
      const { data, error } = await supabase
        .from('consultations')
        .select('id,user_id,payment_status')
        .eq('id', item.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data && !['paid', 'confirmed', 'completed'].includes(String(data.payment_status || '').toLowerCase())) {
        positions.push({
          source: 'consultation',
          source_id: data.id,
          cart_id: item.rawId || `consultation:${data.id}`,
        });
      }
    }

    if (item.source === 'training' && isUuid(item.id)) {
      const { data, error } = await supabase
        .from('training_enrollments')
        .select('id,user_id,payment_status')
        .eq('id', item.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data && !['paid', 'confirmed', 'completed'].includes(String(data.payment_status || '').toLowerCase())) {
        positions.push({
          source: 'training',
          source_id: data.id,
          cart_id: item.rawId || `training:${data.id}`,
        });
      }
    }
  }

  return positions;
};

const deleteSourcePaymentItems = async (supabase, positions, userId) => {
  const updates = await Promise.all(
    (Array.isArray(positions) ? positions : []).map(async (item) => {
      if (item.source === 'consultation') {
        const result = await supabase
          .from('consultations')
          .delete()
          .eq('id', item.source_id)
          .eq('user_id', userId)
          .not('payment_status', 'in', '(paid,confirmed,completed)');

        if (!result.error) return result;

        return supabase
          .from('consultations')
          .update({
            status: 'cancelled',
            payment_status: 'cancelled',
          })
          .eq('id', item.source_id)
          .eq('user_id', userId)
          .not('payment_status', 'in', '(paid,confirmed,completed)');
      }

      if (item.source === 'training') {
        const result = await supabase
          .from('training_enrollments')
          .delete()
          .eq('id', item.source_id)
          .eq('user_id', userId)
          .not('payment_status', 'in', '(paid,confirmed,completed)');

        if (!result.error) return result;

        return supabase
          .from('training_enrollments')
          .update({
            status: 'cancelled',
            payment_status: 'cancelled',
          })
          .eq('id', item.source_id)
          .eq('user_id', userId)
          .not('payment_status', 'in', '(paid,confirmed,completed)');
      }

      return { error: null };
    }),
  );

  const failedUpdate = updates.find((result) => result?.error);
  if (failedUpdate?.error) throw failedUpdate.error;
};

const refreshAttemptFromTbank = async (request, supabase, attempt) => {
  if (!attempt?.payment_id || attempt.status === 'paid' || attempt.status === 'failed') return attempt;

  const config = await getTbankConfig(request, supabase);
  if (!config.terminalKey || (!config.password && !config.canSignRemotely)) return attempt;

  const payload = {
    TerminalKey: config.terminalKey,
    PaymentId: attempt.payment_id,
  };

  try {
    const token = await signTbankPayload(supabase, payload, config.password);
    const { bankPayload } = await postTbankMethod(config.initUrl, 'GetState', { ...payload, Token: token });
    if (!bankPayload?.Success || !bankPayload?.Status) return attempt;

    const statusPatch = getAttemptStatusPatch(bankPayload);
    const updatedAttempt = {
      ...attempt,
      status: statusPatch.nextStatus,
      raw_notification: bankPayload,
      payment_id: bankPayload.PaymentId ? String(bankPayload.PaymentId) : attempt.payment_id,
    };

    await supabase
      .from('payment_attempts')
      .update({
        payment_id: updatedAttempt.payment_id,
        status: updatedAttempt.status,
        raw_notification: bankPayload,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', attempt.order_id);

    if (statusPatch.isPaid) {
      await applyPaidSourceUpdates(supabase, attempt.cart_items);
    }

    await notifyPaymentTransition(supabase, attempt, updatedAttempt, bankPayload);
    return updatedAttempt;
  } catch (error) {
    console.warn('T-Bank GetState refresh failed:', error?.message || error);
    return attempt;
  }
};

export const tbankInitHandler = async (request, response) => {
  if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'Method not allowed' });

  const body = await readJsonBody(request);
  const supabase = getSupabaseAdmin();
  let session;
  try {
    session = await resolvePaymentUser(request, supabase, body);
  } catch (error) {
    return json(response, 401, {
      ok: false,
      error: error?.message || 'Не удалось подтвердить пользователя',
      code: error?.code || 'PAYMENT_USER_AUTH_FAILED',
    });
  }
  if (!session?.id) {
    return json(response, 401, {
      ok: false,
      error: body?.telegramInitData || body?.telegramUserId || body?.telegram_id
        ? 'Не удалось определить пользователя Telegram для оплаты'
        : 'Сначала войдите в кабинет',
      code: 'SITE_SESSION_REQUIRED',
    });
  }

  const config = await getTbankConfig(request, supabase);
  if (!config.terminalKey || (!config.password && !config.canSignRemotely)) {
    return json(response, 503, {
      ok: false,
      error: 'Т-Банк не настроен. Откройте админку → Услуги → Способы оплаты и заполните Terminal Key и пароль',
      code: 'TBANK_NOT_CONFIGURED',
    });
  }

  const cartItems = (Array.isArray(body.cart) ? body.cart : [])
    .map(normalizeCartItem)
    .filter(Boolean);

  if (!cartItems.length) {
    return json(response, 400, {
      ok: false,
      error: 'Корзина пустая',
      code: 'EMPTY_CART',
    });
  }

  let positions;
  try {
    positions = await getCartPositions(supabase, cartItems, session.id);
  } catch (error) {
    const promoErrorMessage = getTrainingPromoErrorMessage(error);
    if (promoErrorMessage) {
      return json(response, 400, {
        ok: false,
        error: promoErrorMessage,
        code: error?.message || 'TRAINING_PROMO_INVALID',
      });
    }
    throw error;
  }
  const totalRubles = positions.reduce((sum, item) => sum + item.amount, 0);
  const amount = Math.round(totalRubles * 100);

  if (!positions.length || amount <= 0) {
    return json(response, 400, {
      ok: false,
      error: 'В корзине нет позиций к оплате',
      code: 'NO_PAYABLE_ITEMS',
    });
  }

  const orderId = `TB-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const description =
    positions.length === 1
      ? positions[0].title.slice(0, 240)
      : `Tarot by Danil: ${positions.length} позиции`.slice(0, 240);

  const payload = {
    TerminalKey: config.terminalKey,
    Amount: amount,
    OrderId: orderId,
    Description: description,
    CustomerKey: `site-${session.id}`,
    SuccessURL: withQueryParam(config.successUrl, 'order', orderId),
    FailURL: withQueryParam(config.failUrl, 'order', orderId),
    NotificationURL: config.notificationUrl,
    DATA: {
      site_user_id: session.id,
      email: session.email || '',
    },
  };

  const token = await signTbankPayload(supabase, payload, config.password);
  let initResponse;
  let initPayload;

  try {
    const initResult = await postTbankInit(config.initUrl, { ...payload, Token: token });
    initResponse = initResult.bankResponse;
    initPayload = initResult.bankPayload;
  } catch (error) {
    console.error('T-Bank Init request failed:', {
      message: error?.message || String(error),
      code: error?.code || null,
      details: error?.details || null,
    });

    return json(response, 502, {
      ok: false,
      error: error?.message || 'Не удалось подключиться к API Т-Банка',
      code: error?.code || 'TBANK_FETCH_FAILED',
      details: error?.details || null,
    });
  }

  const attemptPayload = {
    user_id: session.id,
    provider: 'tbank',
    order_id: orderId,
    payment_id: initPayload?.PaymentId ? String(initPayload.PaymentId) : null,
    status: initPayload?.Success ? 'created' : 'failed',
    amount: totalRubles,
    description,
    payment_url: initPayload?.PaymentURL || null,
    cart_items: positions,
    raw_response: initPayload,
  };

  const { error: attemptError } = await supabase.from('payment_attempts').insert(attemptPayload);
  if (attemptError) {
    throw new Error(`PAYMENT_ATTEMPT_SAVE_FAILED: ${attemptError.message}`);
  }

  if (!initResponse.ok || !initPayload?.Success || !initPayload?.PaymentURL) {
    const errorMessage = getBankErrorMessage(initPayload);

    return json(response, 502, {
      ok: false,
      error: errorMessage,
      code: initPayload?.ErrorCode || 'TBANK_INIT_FAILED',
      details: initPayload,
    });
  }

  await updateSourcePaymentStatus(supabase, positions, {
    consultation: (item) => ({ payment_status: 'opened', payment_amount: item.amount }),
    training: (item) => ({ payment_status: 'requested', final_price: item.amount }),
  });

  return json(response, 200, {
    ok: true,
    orderId,
    paymentId: String(initPayload.PaymentId || ''),
    paymentUrl: initPayload.PaymentURL,
    amount: totalRubles,
  });
};

export const tbankStatusHandler = async (request, response) => {
  if (request.method !== 'GET') return json(response, 405, { ok: false, error: 'Method not allowed' });

  const orderId = getRequestQueryParam(request, 'order').trim();
  if (!orderId) {
    return json(response, 400, {
      ok: false,
      error: 'Не передан номер заказа',
      code: 'ORDER_REQUIRED',
    });
  }

  const session = readSession(request);
  const supabase = getSupabaseAdmin();
  const { data: attempt, error } = await supabase
    .from('payment_attempts')
    .select('id,user_id,order_id,payment_id,status,amount,description,cart_items,raw_response,raw_notification,created_at,updated_at')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  if (!attempt) {
    return json(response, 404, {
      ok: false,
      error: 'Платёж не найден',
      code: 'PAYMENT_ATTEMPT_NOT_FOUND',
    });
  }

  if (session?.id && attempt.user_id && attempt.user_id !== session.id) {
    return json(response, 403, {
      ok: false,
      error: 'Этот платёж относится к другому кабинету',
      code: 'PAYMENT_OWNER_MISMATCH',
    });
  }

  const refreshedAttempt = await refreshAttemptFromTbank(request, supabase, attempt);

  return json(response, 200, {
    ok: true,
    orderId: refreshedAttempt.order_id,
    paymentId: refreshedAttempt.payment_id,
    amount: refreshedAttempt.amount,
    description: refreshedAttempt.description,
    createdAt: refreshedAttempt.created_at,
    updatedAt: refreshedAttempt.updated_at,
    ...getBankStatusMessage(refreshedAttempt),
  });
};

export const tbankCancelHandler = async (request, response) => {
  if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'Method not allowed' });

  const body = await readJsonBody(request);
  const mode = String(body.mode || body.action || 'cancel').trim().toLowerCase() === 'delete' ? 'delete' : 'cancel';
  const orderId = String(body.orderId || body.order_id || '').trim();
  const supabase = getSupabaseAdmin();
  let session;

  try {
    session = await resolvePaymentUser(request, supabase, body);
  } catch (error) {
    return json(response, 401, {
      ok: false,
      error: error?.message || 'Не удалось подтвердить пользователя',
      code: error?.code || 'PAYMENT_USER_AUTH_FAILED',
    });
  }

  if (!session?.id) {
    return json(response, 401, {
      ok: false,
      error: 'Сначала войдите в кабинет',
      code: 'SITE_SESSION_REQUIRED',
    });
  }

  let attempt = null;
  let cancelPayload = null;
  let positions = [];

  if (orderId) {
    const { data, error } = await supabase
      .from('payment_attempts')
      .select('id,user_id,order_id,payment_id,status,amount,description,cart_items,raw_response,raw_notification,created_at,updated_at')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return json(response, 404, {
        ok: false,
        error: 'Платёж не найден',
        code: 'PAYMENT_ATTEMPT_NOT_FOUND',
      });
    }

    if (data.user_id && data.user_id !== session.id) {
      return json(response, 403, {
        ok: false,
        error: 'Этот платёж относится к другому кабинету',
        code: 'PAYMENT_OWNER_MISMATCH',
      });
    }

    attempt = await refreshAttemptFromTbank(request, supabase, data);
    if (attempt.status === 'paid') {
      return json(response, 409, {
        ok: false,
        error: 'Оплаченный платёж нельзя отменить или удалить',
        code: 'PAYMENT_ALREADY_PAID',
      });
    }

    positions = Array.isArray(attempt.cart_items) ? attempt.cart_items : [];

    if (attempt.payment_id && !['canceled', 'cancelled', 'failed', 'deleted'].includes(String(attempt.status || '').toLowerCase())) {
      const config = await getTbankConfig(request, supabase);
      if (!config.terminalKey || (!config.password && !config.canSignRemotely)) {
        return json(response, 503, {
          ok: false,
          error: 'Т-Банк не настроен, поэтому активную банковскую ссылку нельзя отменить',
          code: 'TBANK_NOT_CONFIGURED',
        });
      }

      const cancelRequest = {
        TerminalKey: config.terminalKey,
        PaymentId: attempt.payment_id,
      };
      const token = await signTbankPayload(supabase, cancelRequest, config.password);
      const { bankPayload } = await postTbankMethod(config.initUrl, 'Cancel', { ...cancelRequest, Token: token });
      cancelPayload = bankPayload;

      if (bankPayload && bankPayload.Success === false && String(bankPayload.ErrorCode || '0') !== '0') {
        return json(response, 502, {
          ok: false,
          error: getBankErrorMessage(bankPayload),
          code: bankPayload.ErrorCode || 'TBANK_CANCEL_FAILED',
          details: bankPayload,
        });
      }
    }
  } else {
    const cartItems = (Array.isArray(body.cart) ? body.cart : [])
      .map(normalizeCartItem)
      .filter(Boolean);

    positions = await getCancelablePositionsFromCart(supabase, cartItems, session.id);
  }

  if (!attempt && positions.length === 0) {
    return json(response, 400, {
      ok: false,
      error: 'Не передан заказ или позиции для отмены',
      code: 'PAYMENT_TARGET_REQUIRED',
    });
  }

  if (mode === 'delete') {
    await deleteSourcePaymentItems(supabase, positions, session.id);

    if (attempt) {
      const { error: deleteAttemptError } = await supabase
        .from('payment_attempts')
        .delete()
        .eq('order_id', attempt.order_id)
        .neq('status', 'paid');

      if (deleteAttemptError) throw deleteAttemptError;
    }

    return json(response, 200, {
      ok: true,
      mode,
      orderId: attempt?.order_id || null,
      title: 'Платёж удалён',
      message: 'Запрос оплаты и неоплаченные позиции удалены',
      bankStatus: cancelPayload?.Status || null,
    });
  }

  await applyCanceledSourceUpdates(supabase, positions);

  if (attempt) {
    const nextRawNotification = cancelPayload || {
      Status: 'CANCELED',
      Success: true,
      Message: 'Canceled locally',
    };

    const { error: updateAttemptError } = await supabase
      .from('payment_attempts')
      .update({
        status: 'canceled',
        raw_notification: nextRawNotification,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', attempt.order_id)
      .neq('status', 'paid');

    if (updateAttemptError) throw updateAttemptError;
  }

  return json(response, 200, {
    ok: true,
    mode,
    orderId: attempt?.order_id || null,
    title: 'Платёж отменён',
    message: 'Ссылка оплаты отменена. Можно создать новый платёж',
    bankStatus: cancelPayload?.Status || 'CANCELED',
  });
};

export const tbankCartSyncHandler = async (request, response) => {
  if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'Method not allowed' });

  const session = readSession(request);
  if (!session?.id) {
    return json(response, 200, {
      ok: true,
      paidCartItemIds: [],
      paidOrders: [],
    });
  }

  const body = await readJsonBody(request);
  const cartItems = (Array.isArray(body.cart) ? body.cart : [])
    .map(normalizeCartItem)
    .filter(Boolean);

  if (!cartItems.length) {
    return json(response, 200, {
      ok: true,
      paidCartItemIds: [],
      paidOrders: [],
    });
  }

  const requestedKeys = new Set(cartItems.map((item) => `${item.source}:${item.id}`));
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payment_attempts')
    .select('id,user_id,order_id,payment_id,status,amount,description,cart_items,raw_response,raw_notification,created_at,updated_at')
    .eq('user_id', session.id)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  const paidCartItemIds = new Set();
  const paidOrders = [];

  for (const storedAttempt of data || []) {
    const attempt = await refreshAttemptFromTbank(request, supabase, storedAttempt);
    if (attempt.status !== 'paid') continue;

    const paidItems = (Array.isArray(attempt.cart_items) ? attempt.cart_items : [])
      .map(getCartItemKey)
      .filter((key) => key && requestedKeys.has(key));

    if (paidItems.length > 0) {
      paidOrders.push({
        orderId: attempt.order_id,
        updatedAt: attempt.updated_at,
        itemIds: paidItems,
      });
      paidItems.forEach((key) => paidCartItemIds.add(key));
    }
  }

  return json(response, 200, {
    ok: true,
    paidCartItemIds: [...paidCartItemIds],
    paidOrders,
  });
};

export const tbankNotificationHandler = async (request, response) => {
  if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  const config = await getTbankConfig(request, supabase);
  if (!config.terminalKey || (!config.password && !config.canSignRemotely)) {
    return response.status(200).send('OK');
  }

  const notification = await readTbankBody(request);
  const tokenIsValid = await verifyTbankPayloadToken(supabase, notification, config.password);

  if (!tokenIsValid) {
    return response.status(403).send('INVALID TOKEN');
  }

  const orderId = String(notification.OrderId || '');
  if (!orderId) return response.status(200).send('OK');

  const status = String(notification.Status || '').toUpperCase();
  const isSuccess = notification.Success === true || String(notification.Success || '').toLowerCase() === 'true';
  const isPaid = isSuccess && ['AUTHORIZED', 'CONFIRMED'].includes(status);
  const isCanceled = ['CANCELED', 'CANCELLED'].includes(status);
  const isFailed = ['REJECTED', 'DEADLINE_EXPIRED'].includes(status);
  const { data: attempt } = await supabase
    .from('payment_attempts')
    .select('id,user_id,order_id,payment_id,status,amount,description,cart_items')
    .eq('order_id', orderId)
    .maybeSingle();

  const nextStatus = isPaid ? 'paid' : isCanceled ? 'canceled' : isFailed ? 'failed' : status.toLowerCase() || 'updated';

  await supabase
    .from('payment_attempts')
    .update({
      payment_id: notification.PaymentId ? String(notification.PaymentId) : null,
      status: nextStatus,
      raw_notification: notification,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId);

  const updatedAttempt = attempt
    ? {
      ...attempt,
      payment_id: notification.PaymentId ? String(notification.PaymentId) : attempt.payment_id,
      order_id: orderId,
      status: nextStatus,
    }
    : {
      user_id: null,
      order_id: orderId,
      payment_id: notification.PaymentId ? String(notification.PaymentId) : null,
      status: nextStatus,
      amount: Number(notification.Amount || 0) / 100,
      cart_items: [],
    };

  if (attempt?.cart_items && isPaid) {
    await updateSourcePaymentStatus(supabase, attempt.cart_items, {
      consultation: {
        payment_status: 'paid',
        payment_marked_at: new Date().toISOString(),
      },
      training: {
        payment_status: 'paid',
      },
    });
  }

  const shouldNotify = !attempt || attempt.status !== nextStatus;

  if (shouldNotify) {
    const adminNotificationResult = await notifyAdminsPaymentEvent(supabase, updatedAttempt, notification).catch((error) => ({
      ok: false,
      error: error?.message || String(error),
    }));

    if (!adminNotificationResult.ok) {
      console.warn('Payment admin notification failed:', adminNotificationResult.error);
    }
  }

  if (isPaid && attempt?.status !== 'paid') {
    const clientNotificationResult = await notifyClientPaymentSucceeded(supabase, updatedAttempt).catch((error) => ({
      ok: false,
      error: error?.message || String(error),
    }));

    if (!clientNotificationResult.ok) {
      console.warn('Payment client notification failed:', clientNotificationResult.error);
    }
  }

  return response.status(200).send('OK');
};
