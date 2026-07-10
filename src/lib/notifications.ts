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
      photoUrl: options.photoUrl,
      replyMarkup,
      botToken,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.error || 'Telegram notification endpoint did not confirm delivery');
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

export const sendTelegramNotification = async (
  chatId: string | number,
  message: string,
  options: NotificationOptions = {}
): Promise<NotificationResult> => {
  try {
    await sendViaServerEndpoint(chatId, message, options);
    return { ok: true };
  } catch (serverError) {
    const errorMessage = getErrorMessage(serverError, 'Unknown server notification error');

    console.error('❌ Ошибка отправки уведомления:', errorMessage);
    return { ok: false, error: errorMessage };
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

export const notifyAdminNewUserRegistration = async (
  adminTelegramIds: Array<string | number>,
  clientName: string,
  clientUsername: string | null,
  telegramId: string | number,
  city?: string | null,
  referredBy?: string | number | null
) => {
  if (adminTelegramIds.length === 0) {
    return { ok: false, error: 'Admin Telegram ID was not found in users table' };
  }

  const usernameText = clientUsername ? ` (@${escapeHtml(clientUsername)})` : '';
  const cityText = city ? `\n📍 <b>Город:</b> ${escapeHtml(city)}` : '';
  const referralText = referredBy ? `\n🤝 <b>Пришёл по рекомендации:</b> ${escapeHtml(referredBy)}` : '';
  const message = `
✨ <b>Новый пользователь зарегистрировался</b>

👤 <b>Клиент:</b> ${escapeHtml(clientName)}${usernameText}
🆔 <b>Telegram ID:</b> ${escapeHtml(telegramId)}${cityText}${referralText}

Профиль уже создан в базе. Можно посмотреть клиента в админке.
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

export const notifyClientTimeProposal = async (
  clientTelegramId: string | number,
  serviceName: string,
  dateTime: string
) => {
  const message = `
🗓 <b>Я предложил время консультации</b>

🃏 <b>Формат:</b> ${escapeHtml(serviceName)}
⏰ <b>Время:</b> ${escapeHtml(dateTime)}

Пожалуйста, зайдите в личный кабинет: можно подтвердить это время или предложить своё.
  `.trim();

  return sendTelegramNotification(clientTelegramId, message);
};

export const notifyClientTimeConfirmed = async (
  clientTelegramId: string | number,
  serviceName: string,
  dateTime: string
) => {
  const message = `
✅ <b>Время консультации подтверждено</b>

🃏 <b>Формат:</b> ${escapeHtml(serviceName)}
⏰ <b>Время:</b> ${escapeHtml(dateTime)}

Запись подтверждена. До встречи!
  `.trim();

  return sendTelegramNotification(clientTelegramId, message);
};

export const notifyClientPaymentRequired = async (
  clientTelegramId: string | number,
  serviceName: string,
  price: number
) => {
  const message = `
💳 <b>Оплата консультации</b>

🃏 <b>Формат:</b> ${escapeHtml(serviceName)}
💰 <b>К оплате:</b> ${price} ₽

Пожалуйста, зайдите в мини-приложение и нажмите кнопку <b>Оплатить</b>. После оплаты отметьте «Я оплатил» — я проверю поступление и подтвержу оплату.
  `.trim();

  return sendTelegramNotification(clientTelegramId, message);
};

export const notifyAdminClientTimeResponse = async (
  adminTelegramIds: Array<string | number>,
  clientName: string,
  serviceName: string,
  responseType: 'accepted' | 'countered',
  dateTime: string
) => {
  if (adminTelegramIds.length === 0) {
    return { ok: false, error: 'Admin Telegram ID was not found in users table' };
  }

  const message = responseType === 'accepted'
    ? `
✅ <b>Клиент подтвердил время</b>

👤 <b>Клиент:</b> ${escapeHtml(clientName)}
🃏 <b>Формат:</b> ${escapeHtml(serviceName)}
⏰ <b>Время:</b> ${escapeHtml(dateTime)}
    `.trim()
    : `
🔁 <b>Клиент предложил другое время</b>

👤 <b>Клиент:</b> ${escapeHtml(clientName)}
🃏 <b>Формат:</b> ${escapeHtml(serviceName)}
💬 <b>Предложение:</b> ${escapeHtml(dateTime)}
    `.trim();

  const results = await Promise.all(adminTelegramIds.map(chatId => sendTelegramNotification(chatId, message)));
  const failed = results.filter(result => !result.ok);

  return failed.length === results.length
    ? { ok: false, error: failed.map(result => result.error).filter(Boolean).join('; ') }
    : { ok: true };
};

export const notifyAdminPaymentMarked = async (
  adminTelegramIds: Array<string | number>,
  clientName: string,
  serviceName: string,
  price: number
) => {
  if (adminTelegramIds.length === 0) {
    return { ok: false, error: 'Admin Telegram ID was not found in users table' };
  }

  const message = `
💳 <b>Клиент отметил оплату</b>

👤 <b>Клиент:</b> ${escapeHtml(clientName)}
🃏 <b>Формат:</b> ${escapeHtml(serviceName)}
💰 <b>Сумма:</b> ${price} ₽

Проверь поступление и нажми <b>Подтвердить оплату</b> в админке.
  `.trim();

  const results = await Promise.all(adminTelegramIds.map(chatId => sendTelegramNotification(chatId, message)));
  const failed = results.filter(result => !result.ok);

  return failed.length === results.length
    ? { ok: false, error: failed.map(result => result.error).filter(Boolean).join('; ') }
    : { ok: true };
};

export const notifyAdminNewTrainingEnrollment = async (
  adminTelegramIds: Array<string | number>,
  clientName: string,
  clientUsername: string | null,
  programName: string,
  price: number,
  groupTitle?: string | null
) => {
  if (adminTelegramIds.length === 0) {
    return { ok: false, error: 'Admin Telegram ID was not found in users table' };
  }

  const usernameText = clientUsername ? ` (@${escapeHtml(clientUsername)})` : '';
  const groupText = groupTitle ? `\n👥 <b>Группа:</b> ${escapeHtml(groupTitle)}` : '';
  const message = `
🎓 <b>Новая заявка на обучение Таро</b>

👤 <b>Клиент:</b> ${escapeHtml(clientName)}${usernameText}
📚 <b>Программа:</b> ${escapeHtml(programName)}${groupText}
💳 <b>Стоимость:</b> ${price} ₽

Заявка ждёт обработки в разделе <b>Обучение</b>.
  `.trim();

  const results = await Promise.all(adminTelegramIds.map(chatId => sendTelegramNotification(chatId, message)));
  const failed = results.filter(result => !result.ok);

  return failed.length === results.length
    ? { ok: false, error: failed.map(result => result.error).filter(Boolean).join('; ') }
    : { ok: true };
};

// Уведомление клиенту об изменении баланса
export const notifyClientBonusUpdate = async (
  clientTelegramId: string | number,
  bonusAmount: number,
  newBalance: number,
  consultationTitle = 'Консультация'
) => {
  return sendTelegramNotification(clientTelegramId, '', {
    photoUrl: getTelegramCardUrl('bonus', {
      title: consultationTitle,
      amount: bonusAmount,
      spent: 0,
      total: newBalance,
      version: Date.now(),
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
