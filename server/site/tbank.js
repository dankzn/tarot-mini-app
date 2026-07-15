import crypto from 'crypto';
import { getSiteUrl, getSupabaseAdmin, readJsonBody, readSession } from './_auth.js';

const TBANK_INIT_URL = 'https://securepay.tinkoff.ru/v2/Init';

const json = (response, status, payload) => response.status(status).json(payload);

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

const getTbankConfig = (request) => {
  const terminalKey = process.env.TBANK_TERMINAL_KEY || process.env.TINKOFF_TERMINAL_KEY || '';
  const password = process.env.TBANK_PASSWORD || process.env.TINKOFF_PASSWORD || '';
  const siteUrl = getSiteUrl(request);

  return {
    terminalKey,
    password,
    initUrl: process.env.TBANK_API_URL || process.env.TINKOFF_API_URL || TBANK_INIT_URL,
    successUrl: process.env.TBANK_SUCCESS_URL || `${siteUrl}/site/payment?payment=success`,
    failUrl: process.env.TBANK_FAIL_URL || `${siteUrl}/site/payment?payment=failed`,
    notificationUrl: process.env.TBANK_NOTIFICATION_URL || `${siteUrl}/api/site/tbank-notification`,
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
  if (!data) throw new Error('TRAINING_ENROLLMENT_NOT_FOUND');
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

  const config = getTbankConfig(request);
  if (!config.terminalKey || !config.password) {
    return json(response, 503, {
      ok: false,
      error: 'Эквайринг Т-Банка пока не настроен',
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

  const supabase = getSupabaseAdmin();
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

  const token = buildToken(payload, config.password);
  const initResponse = await fetch(config.initUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, Token: token }),
  });
  const initPayload = await initResponse.json().catch(() => null);

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
    return json(response, 502, {
      ok: false,
      error: initPayload?.Details || initPayload?.Message || 'Т-Банк не создал платёж',
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

export const tbankNotificationHandler = async (request, response) => {
  if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'Method not allowed' });

  const config = getTbankConfig(request);
  if (!config.terminalKey || !config.password) {
    return response.status(200).send('OK');
  }

  const notification = await readTbankBody(request);
  const incomingToken = String(notification.Token || '');
  const calculatedToken = buildToken(notification, config.password);

  if (
    !incomingToken ||
    incomingToken.length !== calculatedToken.length ||
    !crypto.timingSafeEqual(Buffer.from(incomingToken), Buffer.from(calculatedToken))
  ) {
    return response.status(403).send('INVALID TOKEN');
  }

  const orderId = String(notification.OrderId || '');
  if (!orderId) return response.status(200).send('OK');

  const status = String(notification.Status || '').toUpperCase();
  const isSuccess = notification.Success === true || String(notification.Success || '').toLowerCase() === 'true';
  const isPaid = isSuccess && ['AUTHORIZED', 'CONFIRMED'].includes(status);
  const isFailed = ['REJECTED', 'CANCELED', 'DEADLINE_EXPIRED'].includes(status);
  const supabase = getSupabaseAdmin();

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
