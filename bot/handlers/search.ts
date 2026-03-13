import { BotContext } from '../context';
import { Category } from '@prisma/client';
import { 
  getCategoryFilterKeyboard, 
  getSearchFilterKeyboard, 
  getPlaceCardKeyboard,
  getPaginationKeyboard,
  getBackKeyboard,
} from '../keyboards/main';
import { CATEGORY_NAMES } from '../types';
import { formatPlaceCard, escapeHtml } from '../utils/formatters';
import prisma from '../../src/lib/db';

const ITEMS_PER_PAGE = 5;

// Start search flow
export async function startSearch(ctx: BotContext): Promise<void> {
  ctx.session.search = {
    mode: 'name',
  };
  
  await ctx.reply(
    '🔎 <b>Поиск заведений</b>\n\n' +
    'Введите название заведения или выберите категорию:',
    {
      parse_mode: 'HTML',
      reply_markup: getCategoryFilterKeyboard(),
    }
  );
}

// Search by name
export async function searchByName(ctx: BotContext, query: string): Promise<void> {
  if (!ctx.session.search) {
    ctx.session.search = { mode: 'name' };
  }
  
  ctx.session.search.query = query;
  
  const places = await prisma.place.findMany({
    where: {
      name: {
        contains: query.trim(),
        mode: 'insensitive',
      },
    },
    take: 10,
    orderBy: { rating: 'desc' },
  });
  
  if (places.length === 0) {
    await ctx.reply(
      '🔍 Ничего не найдено. Попробуйте изменить запрос.',
      { reply_markup: getBackKeyboard('back_to_search') }
    );
    return;
  }
  
  await ctx.reply(
    `🔍 Найдено ${places.length} заведений:`,
    { reply_markup: getBackKeyboard('back_to_menu') }
  );
  
  // Show first place
  await showPlaceCard(ctx, places[0].id);
}

// Search by category
export async function searchByCategory(ctx: BotContext, category: Category, page: number = 1): Promise<void> {
  if (!ctx.session.search) {
    ctx.session.search = { mode: 'category' };
  }
  
  ctx.session.search.category = category;
  
  const where: any = { category };
  
  // Apply filters
  if (ctx.session.search.filterRating) {
    where.rating = { gte: ctx.session.search.filterRating };
  }
  
  if (ctx.session.search.filterWithPhotos) {
    where.photos = { some: {} };
  }
  
  const [places, total] = await Promise.all([
    prisma.place.findMany({
      where,
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
      orderBy: ctx.session.search.filterPopular 
        ? { reviewCount: 'desc' }
        : { rating: 'desc' },
    }),
    prisma.place.count({ where }),
  ]);
  
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  
  if (places.length === 0) {
    await ctx.reply(
      `В категории "${CATEGORY_NAMES[category]}" пока нет заведений.`,
      { reply_markup: getBackKeyboard('back_to_menu') }
    );
    return;
  }
  
  await ctx.reply(
    `${CATEGORY_NAMES[category]} (${total} заведений)`,
    { 
      reply_markup: getPaginationKeyboard(page, totalPages, 'search_page')
        .text('🔍 Фильтры', 'show_filters').row()
        .text('🔙 Меню', 'back_to_menu')
    }
  );
  
  // Show first place
  await showPlaceCard(ctx, places[0].id);
}

// Show place card
export async function showPlaceCard(ctx: BotContext, placeId: string): Promise<void> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
  });
  
  if (!place) {
    await ctx.reply('Заведение не найдено.');
    return;
  }
  
  const message = formatPlaceCard(place);
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getPlaceCardKeyboard(placeId),
  });
}

// Show place reviews
export async function showPlaceReviews(ctx: BotContext, placeId: string, page: number = 1): Promise<void> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      reviews: {
        where: { status: 'APPROVED' },
        skip: (page - 1) * ITEMS_PER_PAGE,
        take: ITEMS_PER_PAGE,
        orderBy: [
          { upvotes: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          user: true,
        },
      },
    },
  });
  
  if (!place) {
    await ctx.reply('Заведение не найдено.');
    return;
  }
  
  if (place.reviews.length === 0) {
    await ctx.reply(
      `📍 ${escapeHtml(place.name)}\n\nОтзывов пока нет. Будьте первым!`,
      { reply_markup: getBackKeyboard('back_to_menu') }
    );
    return;
  }
  
  const total = await prisma.review.count({
    where: { placeId, status: 'APPROVED' },
  });
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  
  await ctx.reply(
    `📍 ${escapeHtml(place.name)} — Отзывы (${total})`,
    { reply_markup: getPaginationKeyboard(page, totalPages, `place_reviews_${placeId}`) }
  );
  
  // Show reviews
  for (const review of place.reviews) {
    const reviewMessage = formatReviewMessage(review);
    const { getReviewVoteKeyboard } = await import('../keyboards/main');
    
    await ctx.reply(reviewMessage, {
      parse_mode: 'HTML',
      reply_markup: getReviewVoteKeyboard(review.id, review.upvotes, review.downvotes),
    });
  }
}

// Format review message
function formatReviewMessage(review: any): string {
  let message = `⭐ <b>${review.overallRating}/10</b>`;
  
  if (review.foodRating || review.serviceRating || review.atmosphereRating || review.valueRating) {
    message += '\n';
    if (review.foodRating) message += `🍽 ${review.foodRating} `;
    if (review.serviceRating) message += `🤝 ${review.serviceRating} `;
    if (review.atmosphereRating) message += `🏠 ${review.atmosphereRating} `;
    if (review.valueRating) message += `💰 ${review.valueRating}`;
  }
  
  message += `\n\n${escapeHtml(review.text)}`;
  
  if (review.user?.username) {
    message += `\n\n— @${review.user.username}`;
  }
  
  return message;
}

// Apply rating filter
export async function applyRatingFilter(ctx: BotContext, rating: number): Promise<void> {
  if (!ctx.session.search) return;
  
  ctx.session.search.filterRating = rating;
  
  await ctx.reply(`⭐ Фильтр: рейтинг от ${rating}/10`, {
    reply_markup: getSearchFilterKeyboard(),
  });
}

// Toggle photos filter
export async function togglePhotosFilter(ctx: BotContext): Promise<void> {
  if (!ctx.session.search) return;
  
  ctx.session.search.filterWithPhotos = !ctx.session.search.filterWithPhotos;
  
  const status = ctx.session.search.filterWithPhotos ? 'включён' : 'выключен';
  await ctx.reply(`📷 Фильтр фото ${status}`, {
    reply_markup: getSearchFilterKeyboard(),
  });
}

// Toggle popular filter
export async function togglePopularFilter(ctx: BotContext): Promise<void> {
  if (!ctx.session.search) return;
  
  ctx.session.search.filterPopular = !ctx.session.search.filterPopular;
  
  const status = ctx.session.search.filterPopular ? 'включён' : 'выключен';
  await ctx.reply(`👍 Фильтр популярности ${status}`, {
    reply_markup: getSearchFilterKeyboard(),
  });
}

// Reset filters
export async function resetFilters(ctx: BotContext): Promise<void> {
  if (!ctx.session.search) return;
  
  ctx.session.search.filterRating = undefined;
  ctx.session.search.filterWithPhotos = undefined;
  ctx.session.search.filterPopular = undefined;
  
  await ctx.reply('🔄 Фильтры сброшены', {
    reply_markup: getSearchFilterKeyboard(),
  });
}
