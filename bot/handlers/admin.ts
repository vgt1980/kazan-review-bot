import { BotContext } from '../context';
import { ReviewStatus, ComplaintStatus, Category } from '@prisma/client';
import { 
  getAdminMenuKeyboard,
  getModerationKeyboard,
  getRejectReasonKeyboard,
  getUserManageKeyboard,
  getUserListKeyboard,
  getReviewListKeyboard,
  getStatsKeyboard,
} from '../keyboards/admin';
import { getBackKeyboard } from '../keyboards/main';
import { formatReviewForModeration, formatStatsSummary, escapeHtml } from '../utils/formatters';
import { getUserStatus } from '../utils/validators';
import prisma from '../../src/lib/db';

const ITEMS_PER_PAGE = 10;

// Check if user is admin
async function isAdmin(ctx: BotContext): Promise<boolean> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return false;
  
  // Check env var
  const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim());
  if (adminIds.includes(telegramId)) return true;
  
  // Check database
  const user = await prisma.user.findUnique({
    where: { telegramId },
    include: { adminInfo: true },
  });
  
  return !!user?.adminInfo;
}

// Show admin menu
export async function showAdminMenu(ctx: BotContext): Promise<void> {
  if (!await isAdmin(ctx)) {
    await ctx.reply('⛔ У вас нет доступа к панели администратора.');
    return;
  }
  
  await ctx.reply('🔧 <b>Панель администратора</b>', {
    parse_mode: 'HTML',
    reply_markup: getAdminMenuKeyboard(),
  });
}

// Show pending reviews for moderation
export async function showModerationQueue(ctx: BotContext): Promise<void> {
  if (!await isAdmin(ctx)) return;
  
  const reviews = await prisma.review.findMany({
    where: { status: ReviewStatus.PENDING },
    take: 5,
    orderBy: { createdAt: 'asc' },
    include: {
      place: true,
      user: true,
    },
  });
  
  const total = await prisma.review.count({
    where: { status: ReviewStatus.PENDING },
  });
  
  if (reviews.length === 0) {
    await ctx.reply('✅ Нет отзывов на модерации.', {
      reply_markup: getBackKeyboard('admin_menu'),
    });
    return;
  }
  
  await ctx.reply(
    `📝 <b>Отзывы на модерации</b> (${total})`,
    { parse_mode: 'HTML' }
  );
  
  // Show each review
  for (const review of reviews) {
    const message = formatReviewForModeration(review);
    
    // Send text
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getModerationKeyboard(review.id),
    });
    
    // Send photos if any
    const photos = await prisma.reviewPhoto.findMany({
      where: { reviewId: review.id },
    });
    
    for (const photo of photos) {
      try {
        await ctx.replyWithPhoto(photo.fileId);
      } catch (e) {
        console.error('Failed to send photo:', e);
      }
    }
  }
}

// Approve review
export async function approveReview(ctx: BotContext, reviewId: string): Promise<void> {
  if (!await isAdmin(ctx)) return;
  
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { place: true, user: true },
  });
  
  if (!review) {
    await ctx.reply('Отзыв не найден.');
    return;
  }
  
  // Update review status
  const telegramId = ctx.from?.id.toString();
  const admin = await prisma.user.findUnique({
    where: { telegramId },
  });
  
  await prisma.review.update({
    where: { id: reviewId },
    data: {
      status: ReviewStatus.APPROVED,
      moderatedBy: admin?.id,
      moderatedAt: new Date(),
      publishedAt: new Date(),
    },
  });
  
  // Update place stats
  await updatePlaceStats(review.placeId);
  
  // Update user review count
  await prisma.user.update({
    where: { id: review.userId },
    data: {
      reviewCount: { increment: 1 },
      status: getUserStatus(review.user.reviewCount + 1),
    },
  });
  
  // Notify user
  try {
    await ctx.api.sendMessage(
      review.user.telegramId,
      '✅ Ваш отзыв опубликован!\n\n' +
      `📍 ${review.place.name}\n` +
      `⭐ ${review.overallRating}/10`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    console.error('Failed to notify user:', e);
  }
  
  // Publish to channel
  const channelId = process.env.CHANNEL_ID;
  if (channelId) {
    try {
      const { formatReviewForChannel } = await import('../utils/formatters');
      const message = formatReviewForChannel({
        place: review.place,
        overallRating: review.overallRating,
        foodRating: review.foodRating,
        serviceRating: review.serviceRating,
        atmosphereRating: review.atmosphereRating,
        valueRating: review.valueRating,
        text: review.text,
        user: review.user,
      });
      
      // Get photos
      const photos = await prisma.reviewPhoto.findMany({
        where: { reviewId: review.id },
      });
      
      if (photos.length > 0) {
        // Send with first photo
        await ctx.api.sendPhoto(channelId, photos[0].fileId, {
          caption: message,
          parse_mode: 'HTML',
        });
        
        // Send additional photos
        for (let i = 1; i < photos.length; i++) {
          await ctx.api.sendPhoto(channelId, photos[i].fileId);
        }
      } else {
        await ctx.api.sendMessage(channelId, message, { parse_mode: 'HTML' });
      }
    } catch (e) {
      console.error('Failed to publish to channel:', e);
    }
  }
  
  await ctx.answerCallbackQuery('✅ Отзыв опубликован');
  await ctx.deleteMessage();
}

// Reject review
export async function rejectReview(
  ctx: BotContext, 
  reviewId: string, 
  reason: string
): Promise<void> {
  if (!await isAdmin(ctx)) return;
  
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { place: true, user: true },
  });
  
  if (!review) {
    await ctx.reply('Отзыв не найден.');
    return;
  }
  
  const telegramId = ctx.from?.id.toString();
  const admin = await prisma.user.findUnique({
    where: { telegramId },
  });
  
  await prisma.review.update({
    where: { id: reviewId },
    data: {
      status: ReviewStatus.REJECTED,
      moderatedBy: admin?.id,
      moderatedAt: new Date(),
      rejectionReason: reason,
    },
  });
  
  // Notify user
  try {
    await ctx.api.sendMessage(
      review.user.telegramId,
      '❌ Ваш отзыв отклонён.\n\n' +
      `📍 ${review.place.name}\n` +
      `Причина: ${reason}`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    console.error('Failed to notify user:', e);
  }
  
  await ctx.answerCallbackQuery('❌ Отзыв отклонён');
  await ctx.deleteMessage();
}

// Show reject reasons
export async function showRejectReasons(ctx: BotContext, reviewId: string): Promise<void> {
  await ctx.reply('Выберите причину отклонения:', {
    reply_markup: getRejectReasonKeyboard(reviewId),
  });
}

// Block user
export async function blockUser(
  ctx: BotContext, 
  userId: string, 
  reason: string = 'Нарушение правил'
): Promise<void> {
  if (!await isAdmin(ctx)) return;
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  
  if (!user) {
    await ctx.reply('Пользователь не найден.');
    return;
  }
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      isBlocked: true,
      blockedAt: new Date(),
      blockReason: reason,
    },
  });
  
  // Notify user
  try {
    await ctx.api.sendMessage(
      user.telegramId,
      `🚫 Ваш аккаунт заблокирован.\n\nПричина: ${reason}`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    console.error('Failed to notify user:', e);
  }
  
  await ctx.answerCallbackQuery('🚫 Пользователь заблокирован');
}

// Unblock user
export async function unblockUser(ctx: BotContext, userId: string): Promise<void> {
  if (!await isAdmin(ctx)) return;
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      isBlocked: false,
      blockedAt: null,
      blockReason: null,
    },
  });
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  
  if (user) {
    try {
      await ctx.api.sendMessage(
        user.telegramId,
        '✅ Ваш аккаунт разблокирован.',
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      console.error('Failed to notify user:', e);
    }
  }
  
  await ctx.answerCallbackQuery('✅ Пользователь разблокирован');
}

// Show users list
export async function showUsersList(ctx: BotContext, page: number = 1): Promise<void> {
  if (!await isAdmin(ctx)) return;
  
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
  ]);
  
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  
  await ctx.reply(
    `👥 <b>Пользователи</b> (${total})`,
    {
      parse_mode: 'HTML',
      reply_markup: getUserListKeyboard(users, page, totalPages),
    }
  );
}

// Show user details
export async function showUserDetails(ctx: BotContext, userId: string): Promise<void> {
  if (!await isAdmin(ctx)) return;
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: { reviews: true },
      },
    },
  });
  
  if (!user) {
    await ctx.reply('Пользователь не найден.');
    return;
  }
  
  const message = `
👤 <b>Пользователь</b>

📱 Telegram ID: <code>${user.telegramId}</code>
👤 Username: ${user.username ? '@' + user.username : 'не указан'}
📛 Имя: ${user.firstName || 'не указано'}
📝 Отзывов: ${user._count.reviews}
📊 Статус: ${user.status}
🚫 Заблокирован: ${user.isBlocked ? 'Да' : 'Нет'}
📅 Регистрация: ${user.createdAt.toLocaleDateString('ru-RU')}
  `.trim();
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getUserManageKeyboard(userId, user.isBlocked),
  });
}

// Show statistics
export async function showStatistics(ctx: BotContext): Promise<void> {
  if (!await isAdmin(ctx)) return;
  
  const [
    totalUsers,
    totalPlaces,
    totalReviews,
    pendingReviews,
    todayReviews,
    todayUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.place.count(),
    prisma.review.count({ where: { status: ReviewStatus.APPROVED } }),
    prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
    prisma.review.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);
  
  const message = formatStatsSummary({
    totalUsers,
    totalPlaces,
    totalReviews,
    pendingReviews,
    todayReviews,
    todayUsers,
  });
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getStatsKeyboard(),
  });
}

// Update place statistics
async function updatePlaceStats(placeId: string): Promise<void> {
  const reviews = await prisma.review.findMany({
    where: { placeId, status: ReviewStatus.APPROVED },
    select: {
      overallRating: true,
      foodRating: true,
      serviceRating: true,
      atmosphereRating: true,
      valueRating: true,
    },
  });
  
  if (reviews.length === 0) return;
  
  const avgOverall = reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length;
  const avgFood = reviews.filter(r => r.foodRating).reduce((sum, r) => sum + (r.foodRating || 0), 0) / reviews.filter(r => r.foodRating).length;
  const avgService = reviews.filter(r => r.serviceRating).reduce((sum, r) => sum + (r.serviceRating || 0), 0) / reviews.filter(r => r.serviceRating).length;
  const avgAtmosphere = reviews.filter(r => r.atmosphereRating).reduce((sum, r) => sum + (r.atmosphereRating || 0), 0) / reviews.filter(r => r.atmosphereRating).length;
  const avgValue = reviews.filter(r => r.valueRating).reduce((sum, r) => sum + (r.valueRating || 0), 0) / reviews.filter(r => r.valueRating).length;
  
  await prisma.place.update({
    where: { id: placeId },
    data: {
      rating: avgOverall,
      reviewCount: reviews.length,
      avgFood: avgFood || 0,
      avgService: avgService || 0,
      avgAtmosphere: avgAtmosphere || 0,
      avgValue: avgValue || 0,
    },
  });
}

// ==================== PLACE MANAGEMENT ====================

// Interface for add place session
interface AddPlaceSession {
  step: 'category' | 'name' | 'district' | 'address' | 'confirm';
  category?: Category;
  name?: string;
  district?: string;
  address?: string;
}

// Show places list for admin
export async function showAdminPlaces(ctx: BotContext, page: number = 1): Promise<void> {
  try {
    if (!await isAdmin(ctx)) {
      await ctx.answerCallbackQuery('⛔ Нет доступа');
      return;
    }
    
    const [places, total] = await Promise.all([
      prisma.place.findMany({
        skip: (page - 1) * ITEMS_PER_PAGE,
        take: ITEMS_PER_PAGE,
        orderBy: { name: 'asc' },
      }),
      prisma.place.count(),
    ]);
    
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
    
    let message = `🏪 <b>Управление заведениями</b> (${total})\n\n`;
    
    if (places.length === 0) {
      message += 'Заведений пока нет. Добавьте первое!';
    } else {
      places.forEach((place) => {
        const catEmoji = {
          RESTAURANT: '🍔',
          CAFE: '☕',
          SHOP: '🛍',
          BEAUTY: '💅',
          MALL: '🏬',
          SERVICE: '🚗',
          OTHER: '📦',
        }[place.category] || '📍';
        
        message += `${catEmoji} ${place.name}\n`;
        if (place.district) {
          message += `   📍 ${place.district}`;
          if (place.rating > 0) {
            message += ` • ⭐ ${place.rating.toFixed(1)}`;
          }
          message += '\n';
        }
      });
    }
    
    const { getPlacesAdminKeyboard } = await import('../keyboards/admin');
    
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getPlacesAdminKeyboard(page, totalPages),
    });
    
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('Error in showAdminPlaces:', error);
    await ctx.answerCallbackQuery('❌ Произошла ошибка');
    await ctx.reply('❌ Произошла ошибка при загрузке заведений. Попробуйте позже.');
  }
}

// Start add place flow
export async function addPlaceStart(ctx: BotContext): Promise<void> {
  if (!await isAdmin(ctx)) return;
  
  // Initialize add place session
  ctx.session.admin = {
    mode: 'add_place',
  };
  
  const { getAddPlaceCategoryKeyboard } = await import('../keyboards/admin');
  
  await ctx.reply(
    '➕ <b>Добавление заведения</b>\n\n' +
    'Выберите категорию:',
    {
      parse_mode: 'HTML',
      reply_markup: getAddPlaceCategoryKeyboard(),
    }
  );
}

// Process add place flow
export async function addPlaceProcess(
  ctx: BotContext, 
  step: 'category' | 'text', 
  data: string | Category
): Promise<void> {
  if (!await isAdmin(ctx)) return;
  
  const admin = ctx.session.admin;
  if (!admin || admin.mode !== 'add_place') {
    await addPlaceStart(ctx);
    return;
  }
  
  // Get or create session data
  const sessionData: AddPlaceSession = (admin as any).addPlaceData || {
    step: 'category',
  };
  
  if (step === 'category') {
    // Category selected
    sessionData.category = data as Category;
    sessionData.step = 'name';
    
    // Save session
    (admin as any).addPlaceData = sessionData;
    
    await ctx.reply(
      `Категория: ${getCategoryName(sessionData.category)}\n\n` +
      'Введите название заведения:',
      { reply_markup: getBackKeyboard('admin_cancel_add') }
    );
  } else if (step === 'text') {
    const text = data as string;
    
    if (sessionData.step === 'name') {
      // Name entered
      if (text.trim().length < 2) {
        await ctx.reply('❌ Название слишком короткое. Введите название:');
        return;
      }
      
      // Check for duplicates
      const existing = await prisma.place.findFirst({
        where: {
          name: { equals: text.trim(), mode: 'insensitive' },
          category: sessionData.category,
        },
      });
      
      if (existing) {
        await ctx.reply(
          `⚠️ Заведение "${text}" уже существует в этой категории.\n\n` +
          'Введите другое название:',
          { reply_markup: getBackKeyboard('admin_cancel_add') }
        );
        return;
      }
      
      sessionData.name = text.trim();
      sessionData.step = 'district';
      (admin as any).addPlaceData = sessionData;
      
      await ctx.reply(
        `Название: ${sessionData.name}\n\n` +
        'Введите район (например: Вахитовский, Приволжский):',
        { reply_markup: getBackKeyboard('admin_cancel_add') }
      );
    } else if (sessionData.step === 'district') {
      // District entered
      sessionData.district = text.trim();
      sessionData.step = 'address';
      (admin as any).addPlaceData = sessionData;
      
      await ctx.reply(
        `Район: ${sessionData.district}\n\n` +
        'Введите адрес (можно пропустить командой /skip):',
        { reply_markup: getBackKeyboard('admin_cancel_add') }
      );
    } else if (sessionData.step === 'address' || text === '/skip') {
      // Address entered or skipped
      if (text !== '/skip') {
        sessionData.address = text.trim();
      }
      sessionData.step = 'confirm';
      (admin as any).addPlaceData = sessionData;
      
      // Show confirmation
      let message = '📝 <b>Проверьте данные:</b>\n\n';
      message += `📂 Категория: ${getCategoryName(sessionData.category!)}\n`;
      message += `📍 Название: ${sessionData.name}\n`;
      message += `🗺 Район: ${sessionData.district || 'не указан'}\n`;
      if (sessionData.address) {
        message += `📍 Адрес: ${sessionData.address}\n`;
      }
      
      const { getAddPlaceConfirmKeyboard } = await import('../keyboards/admin');
      
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: getAddPlaceConfirmKeyboard(),
      });
    }
  }
}

// Confirm add place
export async function addPlaceConfirm(ctx: BotContext): Promise<void> {
  if (!await isAdmin(ctx)) return;
  
  const admin = ctx.session.admin;
  const sessionData: AddPlaceSession = (admin as any)?.addPlaceData;
  
  if (!sessionData || !sessionData.category || !sessionData.name) {
    await ctx.reply('❌ Ошибка: данные не найдены. Начните заново.');
    ctx.session.admin = undefined;
    return;
  }
  
  try {
    const place = await prisma.place.create({
      data: {
        name: sessionData.name,
        category: sessionData.category,
        district: sessionData.district,
        address: sessionData.address,
      },
    });
    
    ctx.session.admin = undefined;
    
    await ctx.reply(
      `✅ Заведение добавлено!\n\n` +
      `📍 ${place.name}\n` +
      `📂 ${getCategoryName(place.category)}\n` +
      `🗺 ${place.district || 'Район не указан'}`,
      { reply_markup: getBackKeyboard('admin_places') }
    );
  } catch (error) {
    console.error('Error creating place:', error);
    await ctx.reply('❌ Ошибка при добавлении заведения. Попробуйте снова.');
  }
}

// Cancel add place
export async function addPlaceCancel(ctx: BotContext): Promise<void> {
  ctx.session.admin = undefined;
  
  await ctx.reply('❌ Добавление отменено.', {
    reply_markup: getBackKeyboard('admin_menu'),
  });
}

// Helper function to get category name
function getCategoryName(category: Category): string {
  const names: Record<Category, string> = {
    RESTAURANT: '🍔 Ресторан',
    CAFE: '☕ Кофейня',
    SHOP: '🛍 Магазин',
    BEAUTY: '💅 Бьюти',
    MALL: '🏬 Торговый центр',
    SERVICE: '🚗 Сервис / услуги',
    OTHER: '📦 Другое',
  };
  return names[category] || category;
}
