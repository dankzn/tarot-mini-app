import os
import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import WebAppInfo

# Настройка логирования
logging.basicConfig(level=logging.INFO)

BOT_TOKEN = os.environ["BOT_TOKEN"]
WEB_APP_URL = os.environ.get("WEB_APP_URL", "https://tarot-mini-app-ruddy.vercel.app")

print(f"✅ BOT_TOKEN: {BOT_TOKEN[:20]}...")
print(f"✅ WEB_APP_URL: {WEB_APP_URL}")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def send_welcome(message: types.Message):
    # Получаем реферальный код из аргументов
    args = message.text.split()
    ref_code = None
    
    if len(args) > 1 and args[1].startswith('ref_'):
        ref_code = args[1].replace('ref_', '')
        print(f"🎯 Реферальная ссылка: ref_{ref_code}")
    
    # Формируем URL
    web_app_url = f"{WEB_APP_URL}/?ref={ref_code}" if ref_code else WEB_APP_URL
    
    # Создаём клавиатуру с WebApp кнопкой
    keyboard = types.ReplyKeyboardMarkup(
        keyboard=[
            [
                types.KeyboardButton(
                    text="✨ Открыть приложение",
                    web_app=WebAppInfo(url=web_app_url)
                )
            ]
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )
    
    if ref_code:
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

async def main():
    print("🤖 Бот запущен...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())