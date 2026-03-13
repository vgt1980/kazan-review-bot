import { BotContext } from '../context';
import { Category, Place } from '@prisma/client';
import { 
  getCategoryKeyboard, 
  getRatingKeyboard, 
  getSkipKeyboard,
  getConfirmKeyboard,
  getPhotoKeyboard,
  getMorePhotosKeyboard,
  getPlacesListKeyboard,
  getBackKeyboard,
} from '../keyboards/main';
import { ReviewStep, CATEGORY_NAMES } from '../types';
import { 
  validateReviewText, 
  sanitizeInput,
} from '../utils/validators';
import { formatReviewForModeration, escapeHtml } from '../utils/formatters';
import prisma from '../../src/lib/db';

const PLACES_PER_PAGE = 8;

// Steps messages
const STEP_MESSAGES = {
  [ReviewStep.SELECT_CATEGORY]: 'Выберите категорию заведения:',
  [ReviewStep.SELECT_PLACE]: 'Выберите заведение из списка:',
  [ReviewStep.ENTER_OVERALL_RATING]: 'Оцените заведение (1-10):',
  [ReviewStep.ENTER_FOOD_RATING]: 'Оцените еду/продукты (1-10):',
  [ReviewStep.ENTER_SERVICE_RATING]: 'Оцените сервис (1-10):',
  [ReviewStep.ENTER_ATMOSPHERE_RATING]: 'Оцените атмосферу (1-10):',
  [ReviewStep.ENTER_VALUE_RATING]: 'Оцените соотношение цена/качество (1-10):',
  [ReviewStep.ENTER_TEXT]: 'Напишите ваш отзыв (минимум 20 символов):',
  [ReviewStep.ADD_PHOTOS]: 'Добавьте фото заведения или чека (необязательно):',
  [ReviewStep.CONFIRMATION]: 'Проверьте данные перед отправкой:',
};

// Start review process
export async function startReview(ctx: BotContext): Promise<void> {
  // Initialize review form in session
  ctx.session.reviewForm = {
    step: ReviewStep.SELECT_CATEGORY,
    photos: [],
    photoType: 'place',
  };
  
  await ctx.reply(STEP_MESSAGES[ReviewStep.SELECT_CATEGORY], {
    reply_markup: getCategoryKeyboard(),
  });
}

// Handle category selection - show places list
export async function handleCategorySelection(ctx: BotContext, category: Category, page: number = 1): Promise<void> {
  if (!ctx.session.reviewForm) {
    return startReview(ctx);
  }
  
  ctx.session.reviewForm.category = category;
  
  // Get places from database (added by admin)
  const [places, total] = await Promise.all([
    prisma.place.findMany({
      where: { category },
      skip: (page - 1) * PLACES_PER_PAGE,
      take: PLACES_PER_PAGE,
      orderBy: { name: 'asc' },
    }),
    prisma.place.count({ where: { category } }),
  ]);
  
  if (places.length === 0) {
    await ctx.reply(
      `❌ В категории "${CATEGORY_NAMES[category]}" пока нет заведений.\n\n` +
      `Администратор добавит заведения в ближайшее время.`,
      { reply_markup: getBackKeyboard('cancel_review') }
    );
    return;
  }
  
  ctx.session.reviewForm.step = ReviewStep.SELECT_PLACE;
  
  const totalPages = Math.ceil(total / PLACES_PER_PAGE);
  
  await ctx.reply(
    `${CATEGORY_NAMES[category]} (${total} заведений)\n\nВыберите заведение:`,
    { reply_markup: getPlacesListKeyboard(places, page, totalPages, category) }
  );
}

// Handle place selection
export async function handlePlaceSelection(ctx: BotContext, placeId: string): Promise<void> {
  if (!ctx.session.reviewForm) return;
  
  const place = await prisma.place.findUnique({
    where: { id: placeId },
  });
  
  if (!place) {
    await ctx.reply('❌ Заведение не найдено.');
    return;
  }
  
  // Check if user already reviewed this place
  const telegramId = ctx.from?.id.toString();
  const user = await prisma.user.findUnique({
    where: { telegramId },
  });
  
  if (user) {
    const existingReview = await prisma.review.findUnique({
      where: {
        placeId_userId: { placeId: place.id, userId: user.id },
      },
    });
    
    if (existingReview) {
      await ctx.reply(
        '❌ Вы уже оставляли отзыв об этом заведении.\n\n' +
        'Один пользователь может оставить только один отзыв на одно заведение.',
        { reply_markup: getBackKeyboard('cancel_review') }
      );
      ctx.session.reviewForm = undefined;
      return;
    }
  }
  
  ctx.session.reviewForm.placeId = place.id;
  ctx.session.reviewForm.placeName = place.name;
  ctx.session.reviewForm.district = place.district || undefined;
  ctx.session.reviewForm.step = ReviewStep.ENTER_OVERALL_RATING;
  
  let message = `📍 <b>${escapeHtml(place.name)}</b>\n`;
  message += `${CATEGORY_NAMES[place.category]}\n`;
  if (place.district) {
    message += `📍 ${place.district}\n`;
  }
  if (place.rating > 0) {
    message += `⭐ Рейтинг: ${place.rating.toFixed(1)}/10 (${place.reviewCount} отзывов)\n`;
  }
  message += `\n${STEP_MESSAGES[ReviewStep.ENTER_OVERALL_RATING]}`;
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getRatingKeyboard('overall'),
  });
}

// Handle overall rating
export async function handleOverallRating(ctx: BotContext, rating: number): Promise<void> {
  if (!ctx.session.reviewForm) return;
  
  ctx.session.reviewForm.overallRating = rating;
  ctx.session.reviewForm.step = ReviewStep.ENTER_FOOD_RATING;
  
  await ctx.reply(STEP_MESSAGES[ReviewStep.ENTER_FOOD_RATING], {
    reply_markup: getRatingKeyboard('food'),
  });
}

// Handle food rating
export async function handleFoodRating(ctx: BotContext, rating: number): Promise<void> {
  if (!ctx.session.reviewForm) return;
  
  ctx.session.reviewForm.foodRating = rating;
  ctx.session.reviewForm.step = ReviewStep.ENTER_SERVICE_RATING;
  
  await ctx.reply(STEP_MESSAGES[ReviewStep.ENTER_SERVICE_RATING], {
    reply_markup: getRatingKeyboard('service'),
  });
}

// Handle service rating
export async function handleServiceRating(ctx: BotContext, rating: number): Promise<void> {
  if (!ctx.session.reviewForm) return;
  
  ctx.session.reviewForm.serviceRating = rating;
  ctx.session.reviewForm.step = ReviewStep.ENTER_ATMOSPHERE_RATING;
  
  await ctx.reply(STEP_MESSAGES[ReviewStep.ENTER_ATMOSPHERE_RATING], {
    reply_markup: getRatingKeyboard('atmosphere'),
  });
}

// Handle atmosphere rating
export async function handleAtmosphereRating(ctx: BotContext, rating: number): Promise<void> {
  if (!ctx.session.reviewForm) return;
  
  ctx.session.reviewForm.atmosphereRating = rating;
  ctx.session.reviewForm.step = ReviewStep.ENTER_VALUE_RATING;
  
  await ctx.reply(STEP_MESSAGES[ReviewStep.ENTER_VALUE_RATING], {
    reply_markup: getRatingKeyboard('value'),
  });
}

// Handle value rating
export async function handleValueRating(ctx: BotContext, rating: number): Promise<void> {
  if (!ctx.session.reviewForm) return;
  
  ctx.session.reviewForm.valueRating = rating;
  ctx.session.reviewForm.step = ReviewStep.ENTER_TEXT;
  
  await ctx.reply(STEP_MESSAGES[ReviewStep.ENTER_TEXT], {
    reply_markup: getBackKeyboard('cancel_review'),
  });
}

// Handle review text input
export async function handleTextInput(ctx: BotContext, text: string): Promise<void> {
  if (!ctx.session.reviewForm || ctx.session.reviewForm.step !== ReviewStep.ENTER_TEXT) {
    return;
  }
  
  const validation = validateReviewText(text);
  if (!validation.valid) {
    await ctx.reply(`❌ ${validation.error}`);
    return;
  }
  
  ctx.session.reviewForm.text = sanitizeInput(text);
  ctx.session.reviewForm.step = ReviewStep.ADD_PHOTOS;
  
  await ctx.reply(STEP_MESSAGES[ReviewStep.ADD_PHOTOS], {
    reply_markup: getPhotoKeyboard(),
  });
}

// Handle photo upload
export async function handlePhotoUpload(ctx: BotContext, fileId: string, type: 'place' | 'receipt' = 'place'): Promise<void> {
  if (!ctx.session.reviewForm || ctx.session.reviewForm.step !== ReviewStep.ADD_PHOTOS) {
    return;
  }
  
  ctx.session.reviewForm.photos.push(fileId);
  ctx.session.reviewForm.photoType = type;
  
  const photoCount = ctx.session.reviewForm.photos.length;
  await ctx.reply(
    `📷 Фото добавлено (всего: ${photoCount})`,
    { reply_markup: getMorePhotosKeyboard() }
  );
}

// Handle skip photos
export async function handleSkipPhotos(ctx: BotContext): Promise<void> {
  if (!ctx.session.reviewForm) return;
  
  ctx.session.reviewForm.step = ReviewStep.CONFIRMATION;
  await showConfirmation(ctx);
}

// Handle photos done
export async function handlePhotosDone(ctx: BotContext): Promise<void> {
  if (!ctx.session.reviewForm) return;
  
  ctx.session.reviewForm.step = ReviewStep.CONFIRMATION;
  await showConfirmation(ctx);
}

// Show confirmation
async function showConfirmation(ctx: BotContext): Promise<void> {
  if (!ctx.session.reviewForm) return;
  
  const form = ctx.session.reviewForm;
  
  let message = `📝 <b>Проверьте данные отзыва:</b>\n\n`;
  message += `📂 Категория: ${CATEGORY_NAMES[form.category!]}\n`;
  message += `📍 Заведение: ${escapeHtml(form.placeName!)}\n`;
  if (form.district) {
    message += `📍 Район: ${escapeHtml(form.district)}\n`;
  }
  message += `\n⭐ Общая оценка: ${form.overallRating}/10\n`;
  message += `🍽 Еда: ${form.foodRating}/10\n`;
  message += `🤝 Сервис: ${form.serviceRating}/10\n`;
  message += `🏠 Атмосфера: ${form.atmosphereRating}/10\n`;
  message += `💰 Цена/качество: ${form.valueRating}/10\n`;
  message += `\n💬 Текст: ${escapeHtml(form.text!)}\n`;
  
  if (form.photos.length > 0) {
    message += `📷 Фото: ${form.photos.length} шт.\n`;
  }
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getConfirmKeyboard(),
  });
}

// Handle confirm review
export async function handleConfirmReview(ctx: BotContext): Promise<void> {
  if (!ctx.session.reviewForm) return;
  
  const form = ctx.session.reviewForm;
  const telegramId = ctx.from?.id.toString();
  
  if (!telegramId) {
    await ctx.reply('❌ Ошибка: не удалось определить пользователя.');
    return;
  }
  
  try {
    // Get or create user
    let user = await prisma.user.findUnique({
      where: { telegramId },
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId,
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name,
          languageCode: ctx.from?.language_code,
        },
      });
    }
    
    // Check if user is blocked
    if (user.isBlocked) {
      await ctx.reply('❌ Ваш аккаунт заблокирован. Вы не можете оставлять отзывы.');
      ctx.session.reviewForm = undefined;
      return;
    }
    
    const placeId = form.placeId!;
    
    // Check for existing review (anti-fraud)
    const existingReview = await prisma.review.findUnique({
      where: {
        placeId_userId: { placeId, userId: user.id },
      },
    });
    
    if (existingReview) {
      await ctx.reply('❌ Вы уже оставляли отзыв об этом заведении.');
      ctx.session.reviewForm = undefined;
      return;
    }
    
    // Create review
    const review = await prisma.review.create({
      data: {
        placeId,
        userId: user.id,
        overallRating: form.overallRating!,
        foodRating: form.foodRating,
        serviceRating: form.serviceRating,
        atmosphereRating: form.atmosphereRating,
        valueRating: form.valueRating,
        text: form.text!,
        status: 'PENDING',
      },
      include: {
        place: true,
        user: true,
      },
    });
    
    // Save photos
    if (form.photos.length > 0) {
      await prisma.reviewPhoto.createMany({
        data: form.photos.map((fileId, index) => ({
          reviewId: review.id,
          fileId,
          type: index === 0 ? form.photoType : 'place',
        })),
      });
    }
    
    // Clear session
    ctx.session.reviewForm = undefined;
    
    // Send to moderation
    const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim());
    const moderationMessage = formatReviewForModeration(review);
    
    for (const adminId of adminIds) {
      try {
        const { getModerationKeyboard } = await import('../keyboards/admin');
        await ctx.api.sendMessage(adminId, moderationMessage, {
          parse_mode: 'HTML',
          reply_markup: getModerationKeyboard(review.id),
        });
        
        // Send photos if any
        if (form.photos.length > 0) {
          for (const fileId of form.photos) {
            await ctx.api.sendPhoto(adminId, fileId);
          }
        }
      } catch (e) {
        console.error(`Failed to send moderation message to admin ${adminId}:`, e);
      }
    }
    
    await ctx.reply(
      '✅ Спасибо! Ваш отзыв отправлен на модерацию.\n\n' +
      'После проверки он будет опубликован в канале.',
      { reply_markup: getBackKeyboard('back_to_menu') }
    );
    
  } catch (error) {
    console.error('Error creating review:', error);
    await ctx.reply('❌ Произошла ошибка при отправке отзыва. Попробуйте позже.');
  }
}

// Handle edit review
export async function handleEditReview(ctx: BotContext): Promise<void> {
  if (!ctx.session.reviewForm) return;
  
  // Go back to text input step
  ctx.session.reviewForm.step = ReviewStep.ENTER_TEXT;
  await ctx.reply(
    'Введите новый текст отзыва:',
    { reply_markup: getBackKeyboard('cancel_review') }
  );
}

// Handle cancel review
export async function handleCancelReview(ctx: BotContext): Promise<void> {
  ctx.session.reviewForm = undefined;
  
  await ctx.reply('❌ Отзыв отменён.', {
    reply_markup: getBackKeyboard('back_to_menu'),
  });
}
