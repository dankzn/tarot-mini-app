import crypto from 'node:crypto';

const TBANK_INIT_URL = 'https://securepay.tinkoff.ru/v2/Init';

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

const getTBankConfig = () => ({
  terminalKey:
    process.env.TBANK_TERMINAL_KEY ||
    process.env.T_BANK_TERMINAL_KEY ||
    process.env.TINKOFF_TERMINAL_KEY,
  password:
    process.env.TBANK_PASSWORD ||
    process.env.T_BANK_PASSWORD ||
    process.env.TINKOFF_PASSWORD,
});

const isPrimitiveTokenValue = (value) => (
  value !== undefined &&
  value !== null &&
  typeof value !== 'object'
);

const createToken = (params, password) => {
  const tokenPayload = {
    ...params,
    Password: password,
  };

  const tokenString = Object.keys(tokenPayload)
    .filter(key => key !== 'Token' && isPrimitiveTokenValue(tokenPayload[key]))
    .sort()
    .map(key => String(tokenPayload[key]))
    .join('');

  return crypto.createHash('sha256').update(tokenString).digest('hex');
};

const readTBankResponse = async (bankResponse) => {
  const rawBody = await bankResponse.text();

  try {
    return {
      payload: rawBody ? JSON.parse(rawBody) : null,
      rawBody,
      isJson: true,
    };
  } catch {
    return {
      payload: null,
      rawBody,
      isJson: false,
    };
  }
};

const buildBankError = ({ payload, rawBody, isJson, status }) => {
  if (payload && typeof payload === 'object') {
    return {
      error: payload.Message || payload.Details || 'Т-Банк отклонил создание платежа',
      details: payload.Details || payload.Message || null,
      bank: {
        success: payload.Success ?? false,
        errorCode: payload.ErrorCode || null,
        status,
      },
    };
  }

  return {
    error: isJson
      ? 'Т-Банк вернул пустой ответ'
      : 'Т-Банк вернул некорректный ответ вместо JSON',
    details: rawBody?.trim().startsWith('<')
      ? 'Получен HTML-ответ от платёжного сервиса или промежуточной страницы'
      : (rawBody || null),
    bank: {
      success: false,
      errorCode: null,
      status,
    },
  };
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { terminalKey, password } = getTBankConfig();

  if (!terminalKey || !password) {
    response.status(500).json({ error: 'T-Bank credentials are not configured' });
    return;
  }

  const body = parseBody(request.body);
  const amount = Number(body.amount);
  const orderId = String(body.orderId || '').trim();
  const description = String(body.description || '').trim();

  if (!Number.isInteger(amount) || amount <= 0 || !orderId) {
    response.status(400).json({ error: 'amount and orderId are required' });
    return;
  }

  const paymentPayload = {
    TerminalKey: terminalKey,
    Amount: amount,
    OrderId: orderId,
    Description: description || 'Оплата заказа',
    ...(body.customerKey ? { CustomerKey: String(body.customerKey) } : {}),
    ...(body.successUrl ? { SuccessURL: String(body.successUrl) } : {}),
    ...(body.failUrl ? { FailURL: String(body.failUrl) } : {}),
    ...(body.notificationUrl ? { NotificationURL: String(body.notificationUrl) } : {}),
    ...(body.data && typeof body.data === 'object' ? { DATA: body.data } : {}),
    ...(body.receipt && typeof body.receipt === 'object' ? { Receipt: body.receipt } : {}),
  };

  paymentPayload.Token = createToken(paymentPayload, password);

  try {
    const bankResponse = await fetch(TBANK_INIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(paymentPayload),
    });

    const parsedResponse = await readTBankResponse(bankResponse);
    const bankPayload = parsedResponse.payload;

    if (
      !bankResponse.ok ||
      !bankPayload ||
      bankPayload.Success !== true ||
      typeof bankPayload.PaymentURL !== 'string'
    ) {
      const errorPayload = buildBankError({
        ...parsedResponse,
        status: bankResponse.status,
      });

      response.status(bankResponse.ok ? 502 : bankResponse.status).json(errorPayload);
      return;
    }

    response.status(200).json({
      ok: true,
      paymentUrl: bankPayload.PaymentURL,
      paymentId: bankPayload.PaymentId,
      orderId: bankPayload.OrderId,
    });
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : 'Failed to create T-Bank payment',
    });
  }
}
