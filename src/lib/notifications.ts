
const escapeHtml = (value: string | number | null | undefined): string => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Отправка уведомления через защищенный API endpoint
export const sendTelegramNotification = async (
  chatId: string | number,
  message: string
) => {
  try {
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

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to send notification');
    }
  } catch (error) {
    console.error('❌ Ошибка отправки уведомления:', error);
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

  await sendTelegramNotification(adminTelegramId, message);
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

  await sendTelegramNotification(clientTelegramId, message);
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

  await sendTelegramNotification(clientTelegramId, message);
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
    try {
      await sendTelegramNotification(chatId, message);
      results.success++;
      
      // Задержка 50мс между сообщениями
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      results.failed++;
      results.errors.push(`Ошибка для ${chatId}: ${error}`);
    }
  }

  return results;
};
