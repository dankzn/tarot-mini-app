
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

const TELEGRAM_API_BASE = 'https://api.telegram.org';

const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error ? error.message : fallback;
};

const sendViaServerEndpoint = async (
  chatId: string | number,
  message: string
): Promise<void> => {
  const response = await fetch('/api/telegram/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chatId,
      message,
      parseMode: 'HTML',
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.error || 'Telegram notification endpoint did not confirm delivery');
  }
};

const sendViaLegacyClientToken = async (
  chatId: string | number,
  message: string
): Promise<void> => {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error('Legacy Telegram bot token is not configured');
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.description || 'Telegram API request failed');
  }
};

// Отправка уведомления через защищенный API endpoint с legacy fallback
export const sendTelegramNotification = async (
  chatId: string | number,
  message: string
): Promise<NotificationResult> => {
  try {
    await sendViaServerEndpoint(chatId, message);
    return { ok: true };
  } catch (serverError) {
    try {
      await sendViaLegacyClientToken(chatId, message);
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
  adminTelegramId: string,
  clientName: string,
  clientUsername: string | null,
  serviceName: string,
  dateTime: string,
  price: number
) => {
  const usernameText = clientUsername ? ` (@${escapeHtml(clientUsername)})` : '';
  
  const message = `
🔔 <b>Новая запись!</b>

👤 <b>Клиент:</b> ${escapeHtml(clientName)}${usernameText}
📋 <b>Услуга:</b> ${escapeHtml(serviceName)}
📅 <b>Дата:</b> ${escapeHtml(dateTime)}
💰 <b>Сумма:</b> ${price} ₽

⏳ Статус: Ожидает подтверждения
  `.trim();

  return sendTelegramNotification(adminTelegramId, message);
};

// Уведомление клиенту об изменении баланса
export const notifyClientBonusUpdate = async (
  clientTelegramId: string | number,
  bonusAmount: number,
  newBalance: number
) => {
  const message = `
✨ <b>Бонусы начислены!</b>

💎 Начислено: +${bonusAmount} ₽
💰 Новый баланс: ${newBalance} ₽

Спасибо за консультацию!
  `.trim();

  return sendTelegramNotification(clientTelegramId, message);
};

// Уведомление клиенту об изменении статуса
export const notifyClientStatusChange = async (
  clientTelegramId: string | number,
  newStatus: string
) => {
  const message = `
👑 <b>Ваш статус обновлён!</b>

🎉 Новый статус: <b>${escapeHtml(newStatus)}</b>

Поздравляем! Вы получаете дополнительные преимущества.
  `.trim();

  return sendTelegramNotification(clientTelegramId, message);
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
