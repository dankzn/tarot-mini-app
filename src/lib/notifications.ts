
// Отправка уведомления через Telegram Bot API
export const sendTelegramNotification = async (
  chatId: string,
  message: string
) => {
  try {
    // Получаем токен бота из переменных окружения
    const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      console.error('❌ Telegram Bot Token не найден');
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send notification');
    }

    console.log('✅ Уведомление отправлено');
  } catch (error) {
    console.error('❌ Ошибка отправки уведомления:', error);
  }
};

// Уведомление админу о новой записи
export const notifyAdminNewBooking = async (
  adminTelegramId: string,
  clientName: string,
  serviceName: string,
  dateTime: string,
  price: number
) => {
  const message = `
🔔 <b>Новая запись!</b>

 <b>Клиент:</b> ${clientName}
📋 <b>Услуга:</b> ${serviceName}
📅 <b>Дата:</b> ${dateTime}
 <b>Сумма:</b> ${price} ₽

⏳ Статус: Ожидает подтверждения
  `.trim();

  await sendTelegramNotification(adminTelegramId, message);
};

// Уведомление клиенту об изменении баланса
export const notifyClientBonusUpdate = async (
  clientTelegramId: string,
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
  clientTelegramId: string,
  newStatus: string
) => {
  const message = `
👑 <b>Ваш статус обновлён!</b>

🎉 Новый статус: <b>${newStatus}</b>

Поздравляем! Вы получаете дополнительные преимущества.
  `.trim();

  await sendTelegramNotification(clientTelegramId, message);
};