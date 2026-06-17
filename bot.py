import os
import telebot
from telebot import types

BOT_TOKEN = os.getenv("8844983125:AAEQaH2P8PqG4VnB8iibHyWlaG_an940hPA")
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://tarot-mini-app-ruddy.vercel.app")

# Дебаг - выводим что получили
print(f"🔍 BOT_TOKEN: {'Есть' if BOT_TOKEN else 'НЕТ!'}")
print(f"🔍 WEB_APP_URL: {WEB_APP_URL}")
print(f"🔍 Все переменные: {os.environ.keys()}")

if not BOT_TOKEN:
    print("❌ ОШИБКА: BOT_TOKEN не найден!")
    exit(1)

bot = telebot.TeleBot(BOT_TOKEN)

@bot.message_handler(commands=['start'])
def send_welcome(message):
    args = message.text.split()
    ref_code = None
    
    if len(args) > 1 and args[1].startswith('ref_'):
        ref_code = args[1].replace('ref_', '')
        print(f"🎯 Реферальная ссылка: ref_{ref_code}")
    
    web_app_url = f"{WEB_APP_URL}/?ref={ref_code}" if ref_code else WEB_APP_URL
    
    markup = types.InlineKeyboardMarkup()
    btn = types.InlineKeyboardButton("✨ Открыть приложение", url=web_app_url)
    markup.add(btn)
    
    if ref_code:
        bot.reply_to(message, 
            "🎉 Вас пригласил друг!\n\n"
            "Нажмите кнопку ниже чтобы зарегистрироваться и получить бонус:",
            reply_markup=markup
        )
    else:
        bot.reply_to(message,
            "Добро пожаловать в Tarot by Danil! 🔮\n\n"
            "Нажмите кнопку ниже чтобы начать:",
            reply_markup=markup
        )

print("🤖 Бот запущен...")
bot.infinity_polling()