import { BotContext } from '../context';
import { Category } from '@prisma/client';
import { getCategoryKeyboard, getBackKeyboard } from '../keyboards/main';
import { CATEGORY_NAMES } from '../types';
import { formatTopPlacesList, escapeHtml } from '../utils/formatters';
import prisma from '../../src/lib/db';

const MIN_REVIEWS_FOR_RANKING = 3;
const TOP_PLACES_LIMIT = 10;

// Show rankings menu
export async function showRankingsMenu(ctx: BotContext): Promise<void> {
  await ctx.reply(
    '🏆 <b>Рейтинги заведений</b>\n\n' +
    'Выберите категорию или просмотрите общий рейтинг:',
    {
      parse_mode: 'HTML',
      reply_markup: getCategoryKeyboard().text('🌟 Общий ТОП', 'ranking_all').row()
        .text('⚠️ Худшие места', 'ranking_worst').row()
        .text('🔙 Меню', 'back_to_menu'),
    }
  );
}

// Show top places by category
export async function showTopPlaces(ctx: BotContext, category?: Category): Promise<void> {
  const where: any = {
    reviewCount: { gte: MIN_REVIEWS_FOR_RANKING },
  };
  
  if (category) {
    where.category = category;
  }
  
  const places = await prisma.place.findMany({
    where,
    take: TOP_PLACES_LIMIT,
    orderBy: { rating: 'desc' },
  });
  
  const title = category 
    ? `🏆 ТОП ${CATEGORY_NAMES[category].toLowerCase()} Казани`
    : '🏆 ТОП заведений Казани';
  
  if (places.length === 0) {
    await ctx.reply(
      `${title}\n\nПока нет заведений с достаточным количеством отзывов (минимум ${MIN_REVIEWS_FOR_RANKING}).`,
      { reply_markup: getBackKeyboard('back_to_rankings') }
    );
    return;
  }
  
  const message = formatTopPlacesList(places, title);
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('back_to_rankings'),
  });
}

// Show worst places
export async function showWorstPlaces(ctx: BotContext, category?: Category): Promise<void> {
  const where: any = {
    reviewCount: { gte: MIN_REVIEWS_FOR_RANKING },
  };
  
  if (category) {
    where.category = category;
  }
  
  const places = await prisma.place.findMany({
    where,
    take: TOP_PLACES_LIMIT,
    orderBy: { rating: 'asc' },
  });
  
  const title = '⚠️ Худшие места Казани';
  
  if (places.length === 0) {
    await ctx.reply(
      `${title}\n\nПока нет заведений с достаточным количеством отзывов.`,
      { reply_markup: getBackKeyboard('back_to_rankings') }
    );
    return;
  }
  
  let message = `${title}\n\n`;
  
  places.forEach((place, index) => {
    message += `${index + 1}. <b>${escapeHtml(place.name)}</b>\n`;
    message += `   ⭐ ${place.rating.toFixed(1)} • 👥 ${place.reviewCount} отзывов\n\n`;
  });
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('back_to_rankings'),
  });
}

// Show top reviewers
export async function showTopReviewers(ctx: BotContext): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      reviewCount: { gte: 1 },
      isBlocked: false,
    },
    take: 10,
    orderBy: { reviewCount: 'desc' },
  });
  
  if (users.length === 0) {
    await ctx.reply(
      '🏆 Лучшие ревизоры\n\nПока нет активных авторов отзывов.',
      { reply_markup: getBackKeyboard('back_to_menu') }
    );
    return;
  }
  
  let message = '🏆 <b>Лучшие ревизоры месяца</b>\n\n';
  
  users.forEach((user, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    const displayName = user.username ? `@${user.username}` : (user.firstName || 'Аноним');
    message += `${medal} <b>${escapeHtml(displayName)}</b>\n`;
    message += `   📝 ${user.reviewCount} отзывов • 👍 ${user.helpfulVotes}\n\n`;
  });
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('back_to_menu'),
  });
}

// Show place statistics
export async function showPlaceStats(ctx: BotContext, placeId: string): Promise<void> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      _count: {
        select: {
          reviews: true,
          photos: true,
        },
      },
    },
  });
  
  if (!place) {
    await ctx.reply('Заведение не найдено.');
    return;
  }
  
  // Get rating distribution
  const reviews = await prisma.review.findMany({
    where: { placeId, status: 'APPROVED' },
    select: { overallRating: true },
  });
  
  const ratingDistribution: Record<number, number> = {};
  for (let i = 1; i <= 10; i++) {
    ratingDistribution[i] = 0;
  }
  reviews.forEach(r => {
    ratingDistribution[r.overallRating]++;
  });
  
  let message = `📊 <b>Статистика: ${escapeHtml(place.name)}</b>\n\n`;
  
  message += `⭐ <b>Рейтинг:</b> ${place.rating.toFixed(1)}/10\n`;
  message += `📝 <b>Отзывов:</b> ${place._count.reviews}\n`;
  message += `📷 <b>Фото:</b> ${place._count.photos}\n\n`;
  
  message += `<b>Распределение оценок:</b>\n`;
  for (let i = 10; i >= 1; i--) {
    const count = ratingDistribution[i];
    const bar = '█'.repeat(Math.round(count / Math.max(...Object.values(ratingDistribution)) * 10));
    message += `${i}⭐ ${bar} ${count}\n`;
  }
  
  if (place.avgFood || place.avgService || place.avgAtmosphere || place.avgValue) {
    message += `\n<b>Средние оценки:</b>\n`;
    if (place.avgFood) message += `🍽 Еда: ${place.avgFood.toFixed(1)}\n`;
    if (place.avgService) message += `🤝 Сервис: ${place.avgService.toFixed(1)}\n`;
    if (place.avgAtmosphere) message += `🏠 Атмосфера: ${place.avgAtmosphere.toFixed(1)}\n`;
    if (place.avgValue) message += `💰 Цена/качество: ${place.avgValue.toFixed(1)}\n`;
  }
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard(`place_${placeId}`),
  });
}
