import { BotContext } from '../context';
import { Category } from '@prisma/client';
import { getSubscriptionKeyboard, getBackKeyboard, getPaginationKeyboard } from '../keyboards/main';
import { formatUserProfile, formatUserReviewsList } from '../utils/formatters';
import { getUserStatus } from '../utils/validators';
import prisma from '../../src/lib/db';

// Show user profile
export async function showProfile(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  
  if (!telegramId) {
    await ctx.reply('❌ Ошибка: не удалось определить пользователя.');
    return;
  }
  
  let user = await prisma.user.findUnique({
    where: { telegramId },
    include: {
      _count: {
        select: { reviews: true },
      },
    },
  });
  
  if (!user) {
    // Create new user
    user = await prisma.user.create({
      data: {
        telegramId,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
        languageCode: ctx.from?.language_code,
      },
      include: {
        _count: {
          select: { reviews: true },
        },
      },
    });
  }
  
  const message = formatUserProfile(user);
  
  const keyboard = await import('../keyboards/main').then(m => m.getSubscriptionKeyboard);
  
  // Get user subscriptions
  const subscriptions = await prisma.categorySubscription.findMany({
    where: { userId: user.id },
    select: { category: true },
  });
  
  const subCategories = subscriptions.map(s => s.category);
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getSubscriptionKeyboard(subCategories as Category[]),
  });
}

// Show user reviews
export async function showUserReviews(ctx: BotContext, page: number = 1): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  
  if (!telegramId) {
    await ctx.reply('❌ Ошибка: не удалось определить пользователя.');
    return;
  }
  
  const user = await prisma.user.findUnique({
    where: { telegramId },
  });
  
  if (!user) {
    await ctx.reply('Профиль не найден. Отправьте /start для регистрации.');
    return;
  }
  
  const reviews = await prisma.review.findMany({
    where: { userId: user.id },
    take: 10,
    skip: (page - 1) * 10,
    orderBy: { createdAt: 'desc' },
    include: {
      place: true,
    },
  });
  
  const total = await prisma.review.count({
    where: { userId: user.id },
  });
  
  const message = formatUserReviewsList(reviews);
  
  if (total > 10) {
    const totalPages = Math.ceil(total / 10);
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getPaginationKeyboard(page, totalPages, 'my_reviews'),
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getBackKeyboard('back_to_profile'),
    });
  }
}

// Toggle category subscription
export async function toggleSubscription(ctx: BotContext, category: Category): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  
  if (!telegramId) {
    return;
  }
  
  const user = await prisma.user.findUnique({
    where: { telegramId },
  });
  
  if (!user) {
    return;
  }
  
  // Check if already subscribed
  const existing = await prisma.categorySubscription.findUnique({
    where: {
      userId_category: { userId: user.id, category },
    },
  });
  
  if (existing) {
    // Unsubscribe
    await prisma.categorySubscription.delete({
      where: { id: existing.id },
    });
    await ctx.reply(`❌ Подписка на ${category} отменена.`);
  } else {
    // Subscribe
    await prisma.categorySubscription.create({
      data: {
        userId: user.id,
        category,
      },
    });
    await ctx.reply(`✅ Вы подписаны на уведомления о новых отзывах в категории ${category}.`);
  }
  
  // Show updated subscription keyboard
  const subscriptions = await prisma.categorySubscription.findMany({
    where: { userId: user.id },
    select: { category: true },
  });
  
  const subCategories = subscriptions.map(s => s.category);
  
  await ctx.reply('Управление подписками:', {
    reply_markup: getSubscriptionKeyboard(subCategories as Category[]),
  });
}

// Start write review from profile
export async function startWriteReview(ctx: BotContext, placeId: string): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  
  if (!telegramId) {
    return;
  }
  
  // Check if user already reviewed this place
  const user = await prisma.user.findUnique({
    where: { telegramId },
  });
  
  if (user) {
    const existing = await prisma.review.findUnique({
      where: {
        placeId_userId: { placeId, userId: user.id },
      },
    });
    
    if (existing) {
      await ctx.reply(
        '❌ Вы уже оставляли отзыв об этом заведении.',
        { reply_markup: getBackKeyboard('back_to_menu') }
      );
      return;
    }
  }
  
  // Import review handler and start review
  const { startReviewForPlace } = await import('./review');
  await startReviewForPlace(ctx, placeId);
}
