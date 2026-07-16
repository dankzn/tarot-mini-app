import crypto from 'crypto';
import https from 'https';
import { getSiteUrl, getSupabaseAdmin, readJsonBody, readSession } from './_auth.js';

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

  if (!['service', 'consultation', 'training'].includes(source) || !id) return null;
  return { source, id, rawId };
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
  const { data, error } = await supabase
    .from('training_enrollments')
    .select('id,user_id,status,payment_status,final_price,training_programs(title,price)')
    .eq('id', item.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return getTrainingProgramPosition(supabase, item, userId);
  if (['paid', 'confirmed', 'completed'].includes(String(data.payment_status || '').toLowerCase())) {
    throw new Error('TRAINING_ALREADY_PAID');
  }

  const program = Array.isArray(data.training_programs) ? data.training_programs[0] : data.training_programs;
  return {
    source: 'training',
    source_id: data.id,
    title: program?.title || 'Обучение Таро',
    amount: Number(data.final_price ?? program?.price ?? 0),
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
    .select('id,status,payment_status,final_price')
    .eq('user_id', userId)
    .eq('program_id', program.id)
    .not('status', 'in', '("cancelled","expelled","completed")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingEnrollmentError) throw existingEnrollmentError;
  if (existingEnrollment && ['paid', 'confirmed', 'completed'].includes(String(existingEnrollment.payment_status || '').toLowerCase())) {
    throw new Error('TRAINING_ALREADY_PAID');
  }

  let enrollment = existingEnrollment;

  if (!enrollment) {
    const { data: createdEnrollment, error: createdEnrollmentError } = await supabase
      .from('training_enrollments')
      .insert({
        user_id: userId,
        program_id: program.id,
        status: 'pending',
        payment_status: 'not_requested',
        final_price: Number(program.price || 0),
      })
      .select('id,status,payment_status,final_price')
      .single();

    if (createdEnrollmentError) throw createdEnrollmentError;
    enrollment = createdEnrollment;
  }

  return {
    source: 'training',
    source_id: enrollment.id,
    title: program.title || 'Обучение Таро',
    amount: Number(enrollment.final_price || program.price || 0),
  };
};

const getCartPositions = async (supabase, cartItems, userId) => {
  const positions = [];

  for (const item of cartItems) {
    if (item.source === 'service') positions.push(await getServicePosition(supabase, item));
    if (item.source === 'consultation') positions.push(await getConsultationPosition(supabase, item, userId));
    if (item.source === 'training') positions.push(await getTrainingPosition(supabase, item, userId));
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

const getRequestQueryParam = (request, key) => {
  const queryValue = request.query?.[key];
  if (Array.isArray(queryValue)) return queryValue[0] || '';
  if (queryValue) return String(queryValue);

  const host = request.headers.host || 'localhost';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const url = new URL(request.url || '/', `${protocol}://${host}`);
  return url.searchParams.get(key) || '';
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

  if (['REJECTED', 'CANCELED', 'DEADLINE_EXPIRED', 'FAILED'].includes(status) || attempt?.status === 'failed') {
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

export const tbankInitHandler = async (request, response) => {
  if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'Method not allowed' });

  const session = readSession(request);
  if (!session?.id) {
    return json(response, 401, {
      ok: false,
      error: 'Сначала войдите в кабинет',
      code: 'SITE_SESSION_REQUIRED',
    });
  }

  const supabase = getSupabaseAdmin();
  const config = await getTbankConfig(request, supabase);
  if (!config.terminalKey || (!config.password && !config.canSignRemotely)) {
    return json(response, 503, {
      ok: false,
      error: 'Т-Банк не настроен. Откройте админку → Услуги → Способы оплаты и заполните Terminal Key и пароль',
      code: 'TBANK_NOT_CONFIGURED',
    });
  }

  const body = await readJsonBody(request);
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

  const positions = await getCartPositions(supabase, cartItems, session.id);
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
    .select('id,user_id,order_id,payment_id,status,amount,description,raw_response,raw_notification,created_at,updated_at')
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

  return json(response, 200, {
    ok: true,
    orderId: attempt.order_id,
    paymentId: attempt.payment_id,
    amount: attempt.amount,
    description: attempt.description,
    ...getBankStatusMessage(attempt),
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
  const isFailed = ['REJECTED', 'CANCELED', 'DEADLINE_EXPIRED'].includes(status);
  const { data: attempt } = await supabase
    .from('payment_attempts')
    .select('id,cart_items')
    .eq('order_id', orderId)
    .maybeSingle();

  await supabase
    .from('payment_attempts')
    .update({
      payment_id: notification.PaymentId ? String(notification.PaymentId) : null,
      status: isPaid ? 'paid' : isFailed ? 'failed' : status.toLowerCase() || 'updated',
      raw_notification: notification,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId);

  if (attempt?.cart_items && isPaid) {
    await updateSourcePaymentStatus(supabase, attempt.cart_items, {
      consultation: {
        payment_status: 'marked_paid',
        payment_marked_at: new Date().toISOString(),
      },
      training: {
        payment_status: 'marked_paid',
      },
    });
  }

  return response.status(200).send('OK');
};
