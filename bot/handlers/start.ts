import { BotContext } from '../context';
import { getMainMenuKeyboard } from '../keyboards/main';

// Welcome message
const WELCOME_MESSAGE = `
🤖 <b>Добро пожаловать в сервис честных отзывов о заведениях Казани!</b>

Здесь пользователи делятся реальным опытом посещения мест города.
Никакой накрутки — только честные отзывы от реальных посетителей.

📌 <b>Возможности:</b>
• ✍️ Оставлять отзывы о любых заведениях
• 🔎 Находить отзывы по названию или категории
• 🏆 Смотреть рейтинги лучших мест
• 📍 Искать заведения рядом с вами

Выберите действие в меню ниже 👇
`;

// About message
const ABOUT_MESSAGE = `
ℹ️ <b>О проекте "Честные отзывы Казани"</b>

Мы создаём независимую систему отзывов о заведениях Казани — 
альтернативу TripAdvisor и Yelp внутри Telegram.

<b>Наши принципы:</b>
✅ Только реальные отзывы от реальных посетителей
✅ Один отзыв на одно заведение от одного пользователя
✅ Модерация всех отзывов перед публикацией
✅ Система голосования за полезность отзывов
✅ Защита от накрутки и фейков

<b>Как это работает:</b>
1. Вы посещаете заведение в Казани
2. Оставляете отзыв с оценками и фото
3. Модераторы проверяют отзыв
4. После одобрения отзыв публикуется в канале

<b>Статусы пользователей:</b>
🌱 Новичок — до 5 отзывов
⭐ Активный — от 5 отзывов
🏆 Эксперт — от 20 отзывов
👑 Топ-ревизор — от 50 отзывов

📝 <b>Версия:</b> 1.0.0
`;

// Handle /start command
export async function handleStart(ctx: BotContext): Promise<void> {
  // Send welcome message with main menu
  await ctx.reply(WELCOME_MESSAGE, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(),
  });
}

// Handle "О проекте" button
export async function handleAbout(ctx: BotContext): Promise<void> {
  await ctx.reply(ABOUT_MESSAGE, {
    parse_mode: 'HTML',
  });
}

// Handle back to menu
export async function handleBackToMenu(ctx: BotContext): Promise<void> {
  // Clear any ongoing session
  if (ctx.session) {
    ctx.session.reviewForm = undefined;
    ctx.session.search = undefined;
    ctx.session.admin = undefined;
  }
  
  await ctx.reply('Главное меню:', {
    reply_markup: getMainMenuKeyboard(),
  });
}
