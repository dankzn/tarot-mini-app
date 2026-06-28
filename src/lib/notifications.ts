const escapeHtml = (value: string | number | null | undefined): string => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

interface NotificationResult {
  ok: boolean;
  error?: string;
}

interface TelegramButton {
  text: string;
  url: string;
}

interface NotificationOptions {
  photoUrl?: string;
  buttons?: TelegramButton[];
}

const TELEGRAM_API_BASE = 'https://api.telegram.org';

const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error ? error.message : fallback;
};

const sendViaServerEndpoint = async (
  chatId: string | number,
  message: string,
  options: NotificationOptions = {}
): Promise<void> => {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const replyMarkup = buildReplyMarkup(options.buttons);

  const response = await fetch('/api/telegram/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chatId,
      message,
      parseMode: 'HTML',
      botToken,
      photoUrl: options.photoUrl,
      replyMarkup,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.error || 'Telegram notification endpoint did not confirm delivery');
  }
};

const sendViaLegacyClientToken = async (
  chatId: string | number,
  message: string,
  options: NotificationOptions = {}
): Promise<void> => {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error('Legacy Telegram bot token is not configured');
  }

  const replyMarkup = buildReplyMarkup(options.buttons);
  const sendMessage = async () => fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });

  const sendPhoto = async () => fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendPhoto`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      photo: options.photoUrl,
      caption: message,
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });

  let response = options.photoUrl ? await sendPhoto() : await sendMessage();
  let payload = await response.json().catch(() => null);

  if (!response.ok && options.photoUrl) {
    response = await sendMessage();
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) {
    throw new Error(payload?.description || 'Telegram API request failed');
  }
};

const buildReplyMarkup = (buttons?: TelegramButton[]) => {
  if (!buttons || buttons.length === 0) return undefined;

  return {
    inline_keyboard: [
      buttons.map(button => ({
        text: button.text,
        url: button.url,
      })),
    ],
  };
};

const getPublicAssetUrl = (path: string) => (
  typeof window === 'undefined'
    ? path
    : new URL(path, window.location.origin).toString()
);

const getTelegramCardDate = (dateTime: string) => {
  const time = dateTime.match(/\d{2}:\d{2}/)?.[0] || '';
  const day = dateTime.match(/\d{1,2}/)?.[0] || '';
  const year = dateTime.match(/\d{4}/)?.[0] || '';

  return [day, year, time].filter(Boolean).join(' ');
};

const getTelegramCardUrl = (
  type: 'booking' | 'admin' | 'bonus' | 'status',
  params: Record<string, string | number | null | undefined> = {}
) => {
  const searchParams = new URLSearchParams({ type });

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  return getPublicAssetUrl(`/api/telegram/card?${searchParams.toString()}`);
};

// Старая схема: сначала прямой клиентский токен, затем server endpoint fallback
export const sendTelegramNotification = async (
  chatId: string | number,
  message: string,
  options: NotificationOptions = {}
): Promise<NotificationResult> => {
  const hasLegacyClientToken = Boolean(import.meta.env.VITE_TELEGRAM_BOT_TOKEN);

  if (hasLegacyClientToken) {
    try {
      await sendViaLegacyClientToken(chatId, message, options);
      return { ok: true };
    } catch (fallbackError) {
      try {
        await sendViaServerEndpoint(chatId, message, options);
        return { ok: true };
      } catch (serverError) {
        const fallbackMessage = getErrorMessage(fallbackError, 'Unknown fallback notification error');
        const serverMessage = getErrorMessage(serverError, 'Unknown server notification error');
        const errorMessage = `${fallbackMessage}; server: ${serverMessage}`;

        console.error('❌ Ошибка отправки уведомления:', errorMessage);
        return { ok: false, error: errorMessage };
      }
    }
  }

  try {
    await sendViaServerEndpoint(chatId, message, options);
    return { ok: true };
  } catch (serverError) {
    try {
      await sendViaLegacyClientToken(chatId, message, options);
      return { ok: true };
    } catch (fallbackError) {
      const serverMessage = getErrorMessage(serverError, 'Unknown server notification error');
      const fallbackMessage = getErrorMessage(fallbackError, 'Unknown fallback notification error');
      const errorMessage = `${serverMessage}; fallback: ${fallbackMessage}`;

      console.error('❌ Ошибка отправки уведомления:', errorMessage);
      return { ok: false, error: errorMessage };
    }
  }
};

// Уведомление админу о новой записи
export const notifyAdminNewBooking = async (
  adminTelegramIds: Array<string | number>,
  clientName: string,
  clientUsername: string | null,
  serviceName: string,
  dateTime: string,
  price: number
) => {
  if (adminTelegramIds.length === 0) {
    const errorMessage = 'Admin Telegram ID was not found in users table';
    console.error('❌ Ошибка отправки уведомления о записи:', errorMessage);
    return { ok: false, error: errorMessage };
  }

  const usernameText = clientUsername ? ` (@${escapeHtml(clientUsername)})` : '';
  const message = `
🔔 <b>Новая заявка на консультацию</b>

👤 <b>Клиент:</b> ${escapeHtml(clientName)}${usernameText}
🃏 <b>Формат:</b> ${escapeHtml(serviceName)}
🗓 <b>Когда:</b> ${escapeHtml(dateTime)}
💳 <b>Стоимость:</b> ${price} ₽

⏳ <b>Статус:</b> ожидает подтверждения

Проверь время и подтверди запись в админке.
  `.trim();
  const options: NotificationOptions = {
    photoUrl: getTelegramCardUrl('admin', {
      price,
      date: getTelegramCardDate(dateTime),
    }),
  };

  const results = await Promise.all(adminTelegramIds.map(chatId => sendTelegramNotification(chatId, message, options)));
  const failed = results.filter(result => !result.ok);

  return failed.length === results.length
    ? { ok: false, error: failed.map(result => result.error).filter(Boolean).join('; ') }
    : { ok: true };
};

export const notifyClientBookingCreated = async (
  clientTelegramId: string | number,
  serviceName: string,
  dateTime: string,
  price: number
) => {
  const message = `
✅ <b>Заявка принята</b>

🃏 <b>Формат:</b> ${escapeHtml(serviceName)}
🗓 <b>Дата и время:</b> ${escapeHtml(dateTime)}
💳 <b>Стоимость:</b> ${price} ₽

Я получил вашу запись. Следующий шаг — подтверждение времени.

Маршрут записи:
1) заявка отправлена
2) подтверждение
3) консультация
4) рекомендации после встречи
  `.trim();

  return sendTelegramNotification(clientTelegramId, message, {
    photoUrl: getTelegramCardUrl('booking', {
      price,
      date: getTelegramCardDate(dateTime),
    }),
  });
};

// Уведомление клиенту об изменении баланса
export const notifyClientBonusUpdate = async (
  clientTelegramId: string | number,
  bonusAmount: number,
  newBalance: number
) => {
  const message = `
✨ <b>Бонусы начислены</b>

💎 <b>Начислено:</b> +${bonusAmount} ₽
💰 <b>Баланс:</b> ${newBalance} ₽

Спасибо за доверие. Бонусы можно использовать при следующей записи.
  `.trim();

  return sendTelegramNotification(clientTelegramId, message, {
    photoUrl: getTelegramCardUrl('bonus', {
      amount: bonusAmount,
      spent: 0,
      total: newBalance,
    }),
  });
};

// Уведомление клиенту об изменении статуса
export const notifyClientStatusChange = async (
  clientTelegramId: string | number,
  newStatus: string
) => {
  const message = `
👑 <b>Статус клиента обновлён</b>

Новый уровень: <b>${escapeHtml(newStatus)}</b>

Это открывает дополнительные преимущества в личном кабинете.
  `.trim();

  return sendTelegramNotification(clientTelegramId, message, {
    photoUrl: getTelegramCardUrl('status'),
  });
};

// Массовая рассылка
export const sendBulkNotification = async (
  telegramIds: string[],
  message: string
) => {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Отправляем с задержкой чтобы не забанили (50 мс между сообщениями)
  for (const chatId of telegramIds) {
    const result = await sendTelegramNotification(chatId, message);

    if (result.ok) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push(`Ошибка для ${chatId}: ${result.error}`);
    }

    // Задержка 50мс между сообщениями
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return results;
};
