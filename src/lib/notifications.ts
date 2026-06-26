import { supabase } from './supabase';

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

// Добавляет уведомление в очередь. Отправляет его уже Python-бот, где хранится BOT_TOKEN.
export const sendTelegramNotification = async (
  chatId: string | number,
  message: string
): Promise<NotificationResult> => {
  const { error } = await supabase
    .from('notification_queue')
    .insert({
      chat_id: String(chatId),
      message,
      parse_mode: 'HTML',
      status: 'pending',
    });

  if (error) {
    console.error('❌ Ошибка постановки уведомления в очередь:', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
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
🔔 <b>Новая запись!</b>

👤 <b>Клиент:</b> ${escapeHtml(clientName)}${usernameText}
📋 <b>Услуга:</b> ${escapeHtml(serviceName)}
📅 <b>Дата:</b> ${escapeHtml(dateTime)}
💰 <b>Сумма:</b> ${price} ₽

⏳ Статус: Ожидает подтверждения
  `.trim();

  const results = await Promise.all(adminTelegramIds.map(chatId => sendTelegramNotification(chatId, message)));
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
✅ <b>Заявка на консультацию принята</b>

📋 <b>Услуга:</b> ${escapeHtml(serviceName)}
📅 <b>Дата:</b> ${escapeHtml(dateTime)}
💰 <b>Сумма:</b> ${price} ₽

Я получил вашу запись и скоро подтвержу её.
  `.trim();

  return sendTelegramNotification(clientTelegramId, message);
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
