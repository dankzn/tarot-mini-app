import os
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils import executor

BOT_TOKEN = os.getenv("8844983125:AAEQaH2P8PqG4VnB8iibHyWlaG_an940hPA")
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://tarot-mini-app-ruddy.vercel.app")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(bot)

@dp.message_handler(commands=['start'])
async def cmd_start(message: types.Message):
    args = message.get_args()
    web_app_url = WEB_APP_URL
    
    if args and args.startswith('ref_'):
        ref_code = args.replace('ref_', '')
        web_app_url = f"{WEB_APP_URL}/?ref={ref_code}"
        print(f"🎯 Реферальная ссылка: ref_{ref_code}")
    
    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton(
            text="✨ Открыть приложение",
            web_app=WebAppInfo(url=web_app_url)
        )
    )
    
    if args and args.startswith('ref_'):
        await message.answer(
            "🎉 Вас пригласил друг!\n\n"
            "Нажмите кнопку ниже чтобы зарегистрироваться и получить бонус:",
            reply_markup=keyboard
        )
    else:
        await message.answer(
            "Добро пожаловать в Tarot by Danil! 🔮\n\n"
            "Нажмите кнопку ниже чтобы начать:",
            reply_markup=keyboard
        )

if __name__ == '__main__':
    print("🤖 Бот запущен...")
    executor.start_polling(dp)