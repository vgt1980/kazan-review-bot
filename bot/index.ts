import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';

// Custom env loader for .env.local
function loadEnvFile(path: string) {
  if (!existsSync(path)) return 0;
  const content = readFileSync(path, 'utf8');
  const lines = content.split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
        count++;
      }
    }
  }
  return count;
}

// Load env files
loadEnvFile('.env.local');
loadEnvFile('.env');

import { Bot, GrammyError } from 'grammy';
import { Category, ReviewStatus } from '@prisma/client';
import { sessionMiddleware } from './session';
import { BotContext } from './context';
import { ReviewStep, CATEGORY_NAMES } from './types';

// Handlers
import { 
  handleStart, 
  handleAbout, 
  handleBackToMenu 
} from './handlers/start';
import { 
  startReview,
  handleCategorySelection,
  handlePlaceSelection,
  handleOverallRating,
  handleFoodRating,
  handleServiceRating,
  handleAtmosphereRating,
  handleValueRating,
  handleTextInput,
  handlePhotoUpload,
  handleSkipPhotos,
  handlePhotosDone,
  handleConfirmReview,
  handleEditReview,
  handleCancelReview,
} from './handlers/review';
import { 
  startSearch,
  searchByName,
  searchByCategory,
  showPlaceCard,
  showPlaceReviews,
} from './handlers/search';
import { 
  showRankingsMenu,
  showTopPlaces,
  showWorstPlaces,
  showTopReviewers,
  showPlaceStats,
} from './handlers/rankings';
import { 
  showProfile,
  showUserReviews,
  toggleSubscription,
} from './handlers/profile';
import { 
  requestLocation,
  handleLocation,
} from './handlers/geo';
import { 
  handleVote,
  startComplaint,
  submitComplaint,
  cancelComplaint,
} from './handlers/interactions';
import {
  showAdminMenu,
  showModerationQueue,
  approveReview,
  rejectReview,
  showRejectReasons,
  blockUser,
  unblockUser,
  showUsersList,
  showUserDetails,
  showStatistics,
  showAdminPlaces,
  addPlaceStart,
  addPlaceProcess,
  addPlaceConfirm,
  addPlaceCancel,
} from './handlers/admin';
import { showAutoPostMenu, handleAutoPostAction, showRSSMenu, handleRSSFetch, handleRSSPublish, handleRSSPublishLatest } from './handlers/autopost';
import { showImportMenu, handleImportAction } from './handlers/import';

// Create bot
const bot = new Bot<BotContext>(process.env.BOT_TOKEN || '');

// Apply session middleware
bot.use(sessionMiddleware);

// Bot initialization promise (for webhook mode)
let botInitPromise: Promise<void> | null = null;

// Initialize bot (needed for webhook mode)
export async function initBot(): Promise<void> {
  if (!botInitPromise) {
    botInitPromise = bot.init();
  }
  await botInitPromise;
}

// ==================== SETUP MENU BUTTON ====================

// Setup bot menu on startup
async function setupBotMenu() {
  // Priority: WEBAPP_URL > VERCEL_URL
  let webAppUrl = process.env.WEBAPP_URL;
  if (!webAppUrl && process.env.VERCEL_URL) {
    webAppUrl = `https://${process.env.VERCEL_URL}`;
  }

  if (webAppUrl) {
    try {
      // Set menu button to open Mini App
      await bot.api.setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: 'Открыть приложение',
          web_app: { url: webAppUrl },
        },
      });
      console.log('✅ Menu button configured with Mini App URL:', webAppUrl);
    } catch (error) {
      console.error('Failed to set menu button:', error);
    }
  } else {
    console.log('⚠️ No WEBAPP_URL set, menu button not configured');
  }
}

// Call setup on startup
setupBotMenu();

// ==================== COMMANDS ====================

bot.command('start', async (ctx) => {
  // Priority: WEBAPP_URL > VERCEL_URL
  let webAppUrl = process.env.WEBAPP_URL;
  if (!webAppUrl && process.env.VERCEL_URL) {
    webAppUrl = `https://${process.env.VERCEL_URL}`;
  }

  if (webAppUrl) {
    // Show keyboard with Mini App button
    await ctx.reply(
      '👋 Добро пожаловать в сервис честных отзывов о заведениях Казани!\n\n' +
      'Нажмите кнопку ниже, чтобы открыть приложение:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Открыть приложение', web_app: { url: webAppUrl } }],
          ],
        },
      }
    );
  } else {
    // Fallback to old text-based UI
    await handleStart(ctx);
  }
});
bot.command('admin', showAdminMenu);
bot.command('addplace', addPlaceStart);

// ==================== MAIN MENU ====================

bot.hears('✍️ Оставить отзыв', startReview);
bot.hears('🔎 Найти отзывы', startSearch);
bot.hears('🏆 Рейтинг заведений', showRankingsMenu);
bot.hears('📍 Найти рядом', requestLocation);
bot.hears('🧑‍💻 Мой профиль', showProfile);
bot.hears('ℹ️ О проекте', handleAbout);
bot.hears('🔙 Назад', handleBackToMenu);

// ==================== REVIEW FLOW ====================

// Category selection - show places list
bot.callbackQuery(/category_(.+)/, async (ctx) => {
  const category = ctx.match[1] as Category;
  await handleCategorySelection(ctx, category);
  await ctx.answerCallbackQuery();
});

// Places pagination
bot.callbackQuery(/places_(.+)_(\d+)/, async (ctx) => {
  const category = ctx.match[1] as Category;
  const page = parseInt(ctx.match[2]);
  await handleCategorySelection(ctx, category, page);
  await ctx.answerCallbackQuery();
});

// Place selection
bot.callbackQuery(/select_place_(.+)/, async (ctx) => {
  const placeId = ctx.match[1];
  await handlePlaceSelection(ctx, placeId);
  await ctx.answerCallbackQuery();
});

// Rating buttons
bot.callbackQuery(/overall_(\d+)/, async (ctx) => {
  const rating = parseInt(ctx.match[1]);
  await handleOverallRating(ctx, rating);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/food_(\d+)/, async (ctx) => {
  const rating = parseInt(ctx.match[1]);
  await handleFoodRating(ctx, rating);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/service_(\d+)/, async (ctx) => {
  const rating = parseInt(ctx.match[1]);
  await handleServiceRating(ctx, rating);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/atmosphere_(\d+)/, async (ctx) => {
  const rating = parseInt(ctx.match[1]);
  await handleAtmosphereRating(ctx, rating);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/value_(\d+)/, async (ctx) => {
  const rating = parseInt(ctx.match[1]);
  await handleValueRating(ctx, rating);
  await ctx.answerCallbackQuery();
});

// Photo handling
bot.callbackQuery('add_photo', async (ctx) => {
  await ctx.reply('📷 Отправьте фото заведения:');
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('add_receipt', async (ctx) => {
  await ctx.reply('🧾 Отправьте фото чека:');
  if (ctx.session.reviewForm) {
    ctx.session.reviewForm.photoType = 'receipt';
  }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('skip_photos', handleSkipPhotos);
bot.callbackQuery('photos_done', handlePhotosDone);
bot.callbackQuery('add_more_photos', async (ctx) => {
  await ctx.reply('📷 Отправьте ещё фото:');
  await ctx.answerCallbackQuery();
});

// Confirmation
bot.callbackQuery('confirm_review', handleConfirmReview);
bot.callbackQuery('edit_review', handleEditReview);
bot.callbackQuery('cancel_review', handleCancelReview);

// Back to category selection
bot.callbackQuery('back_to_category', async (ctx) => {
  await startReview(ctx);
  await ctx.answerCallbackQuery();
});

// ==================== SEARCH ====================

bot.callbackQuery(/search_cat_(.+)/, async (ctx) => {
  const category = ctx.match[1] as Category;
  await searchByCategory(ctx, category);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/place_(.+)/, async (ctx) => {
  const placeId = ctx.match[1];
  await showPlaceCard(ctx, placeId);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/place_reviews_(.+)/, async (ctx) => {
  const placeId = ctx.match[1];
  await showPlaceReviews(ctx, placeId);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/place_stats_(.+)/, async (ctx) => {
  const placeId = ctx.match[1];
  await showPlaceStats(ctx, placeId);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/write_review_(.+)/, async (ctx) => {
  const placeId = ctx.match[1];
  await handlePlaceSelection(ctx, placeId);
  await ctx.answerCallbackQuery();
});

// ==================== RANKINGS ====================

bot.callbackQuery('ranking_all', async (ctx) => {
  await showTopPlaces(ctx);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('ranking_worst', async (ctx) => {
  await showWorstPlaces(ctx);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('back_to_rankings', async (ctx) => {
  await showRankingsMenu(ctx);
  await ctx.answerCallbackQuery();
});

// ==================== PROFILE ====================

bot.callbackQuery('back_to_profile', async (ctx) => {
  await showProfile(ctx);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/sub_(.+)/, async (ctx) => {
  const category = ctx.match[1] as Category;
  await toggleSubscription(ctx, category);
  await ctx.answerCallbackQuery();
});

// ==================== GEO ====================

bot.on('message:location', async (ctx) => {
  const location = ctx.message.location;
  await handleLocation(ctx, location.latitude, location.longitude);
});

// ==================== VOTES & COMPLAINTS ====================

bot.callbackQuery(/vote_up_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  await handleVote(ctx, reviewId, 'up');
});

bot.callbackQuery(/vote_down_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  await handleVote(ctx, reviewId, 'down');
});

bot.callbackQuery(/complain_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  await startComplaint(ctx, reviewId);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/complaint_(.+)_(.+)/, async (ctx) => {
  const reason = ctx.match[1];
  const reviewId = ctx.match[2];
  await submitComplaint(ctx, reviewId, reason as any);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('cancel_complaint', async (ctx) => {
  await cancelComplaint(ctx);
  await ctx.answerCallbackQuery();
});

// ==================== ADMIN ====================

bot.callbackQuery('admin_menu', showAdminMenu);
bot.callbackQuery('admin_exit', handleBackToMenu);
bot.callbackQuery('admin_moderation', showModerationQueue);
bot.callbackQuery('admin_places', showAdminPlaces);
bot.callbackQuery('admin_users', async (ctx) => {
  await showUsersList(ctx);
  await ctx.answerCallbackQuery();
});
bot.callbackQuery('admin_stats', showStatistics);

// Auto-posting
bot.callbackQuery('admin_autopost', async (ctx) => {
  await showAutoPostMenu(ctx);
  await ctx.answerCallbackQuery();
});
bot.callbackQuery('autopost_random', async (ctx) => {
  await handleAutoPostAction(ctx, 'random');
});
bot.callbackQuery('autopost_top', async (ctx) => {
  await handleAutoPostAction(ctx, 'top');
});
bot.callbackQuery(/autopost_cat_(.+)/, async (ctx) => {
  const category = ctx.match[1];
  await handleAutoPostAction(ctx, `cat_${category}`);
});

// RSS handlers
bot.callbackQuery('autopost_rss', async (ctx) => {
  await showRSSMenu(ctx);
  await ctx.answerCallbackQuery();
});
bot.callbackQuery('rss_fetch', async (ctx) => {
  await handleRSSFetch(ctx);
});
bot.callbackQuery('rss_publish_latest', async (ctx) => {
  await handleRSSPublishLatest(ctx);
});
bot.callbackQuery(/rss_publish_(\d+)/, async (ctx) => {
  const index = parseInt(ctx.match[1]);
  await handleRSSPublish(ctx, index);
});

// Import places
bot.callbackQuery('admin_import', async (ctx) => {
  await showImportMenu(ctx);
  await ctx.answerCallbackQuery();
});
bot.callbackQuery('import_osm_stats', async (ctx) => {
  await handleImportAction(ctx, 'osm_stats');
});
bot.callbackQuery('import_osm_all', async (ctx) => {
  await handleImportAction(ctx, 'osm_all');
});
bot.callbackQuery(/import_osm_(.+)/, async (ctx) => {
  const category = ctx.match[1];
  await handleImportAction(ctx, `osm_${category}`);
});
bot.callbackQuery('import_check_dup', async (ctx) => {
  await handleImportAction(ctx, 'check_dup');
});

// Add place flow
bot.callbackQuery('admin_add_place', addPlaceStart);
bot.callbackQuery(/add_place_cat_(.+)/, async (ctx) => {
  const category = ctx.match[1] as Category;
  await addPlaceProcess(ctx, 'category', category);
  await ctx.answerCallbackQuery();
});
bot.callbackQuery('admin_confirm_place', addPlaceConfirm);
bot.callbackQuery('admin_cancel_add', addPlaceCancel);
bot.callbackQuery('admin_places_page', async (ctx) => {
  // Handle places pagination
  await ctx.answerCallbackQuery();
});

// Moderation actions
bot.callbackQuery(/mod_approve_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  await approveReview(ctx, reviewId);
});

bot.callbackQuery(/mod_reject_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  await showRejectReasons(ctx, reviewId);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/mod_block_user_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  const prisma = (await import('@prisma/client')).PrismaClient;
  const client = new prisma();
  const review = await client.review.findUnique({
    where: { id: reviewId },
    select: { userId: true },
  });
  if (review) {
    await blockUser(ctx, review.userId);
  }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/mod_skip_(.+)/, async (ctx) => {
  await ctx.deleteMessage();
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/mod_back_(.+)/, async (ctx) => {
  await ctx.answerCallbackQuery();
});

// Reject reasons
bot.callbackQuery(/reject_spam_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  await rejectReview(ctx, reviewId, 'Спам');
});

bot.callbackQuery(/reject_false_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  await rejectReview(ctx, reviewId, 'Недостоверная информация');
});

bot.callbackQuery(/reject_insult_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  await rejectReview(ctx, reviewId, 'Оскорбления');
});

bot.callbackQuery(/reject_ads_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  await rejectReview(ctx, reviewId, 'Реклама');
});

bot.callbackQuery(/reject_other_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  await rejectReview(ctx, reviewId, 'Другое');
});

// User management
bot.callbackQuery(/user_view_(.+)/, async (ctx) => {
  const userId = ctx.match[1];
  await showUserDetails(ctx, userId);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/user_block_(.+)/, async (ctx) => {
  const userId = ctx.match[1];
  await blockUser(ctx, userId);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/user_unblock_(.+)/, async (ctx) => {
  const userId = ctx.match[1];
  await unblockUser(ctx, userId);
  await ctx.answerCallbackQuery();
});

// ==================== TEXT MESSAGES ====================

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const step = ctx.session.reviewForm?.step;
  
  // Handle review form steps
  if (step === ReviewStep.ENTER_TEXT) {
    await handleTextInput(ctx, text);
    return;
  }
  
  // Handle admin add place flow
  const admin = ctx.session.admin;
  if (admin?.mode === 'add_place') {
    await addPlaceProcess(ctx, 'text', text);
    return;
  }
  
  // Handle search
  if (ctx.session.search && !ctx.session.search.category) {
    await searchByName(ctx, text);
    return;
  }
  
  // Default response
  await ctx.reply(
    'Я не понял вашу команду. Используйте меню ниже.',
    { reply_markup: (await import('./keyboards/main')).getMainMenuKeyboard() }
  );
});

// ==================== PHOTOS ====================

bot.on('message:photo', async (ctx) => {
  const step = ctx.session.reviewForm?.step;
  
  if (step === ReviewStep.ADD_PHOTOS) {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    await handlePhotoUpload(ctx, fileId);
  }
});

// ==================== ERROR HANDLING ====================

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error('Error in request:', e.description);
  } else {
    console.error('Unknown error:', e);
  }
});

// ==================== EXPORT ====================

export default bot;

// Start bot (for standalone execution)
if (require.main === module) {
  console.log('🤖 Starting Telegram bot...');
  bot.start({
    onStart: () => console.log('✅ Bot started!'),
  });
}
