import { BotContext } from '../context';
import { InlineKeyboard } from 'grammy';
import prisma from '../../src/lib/db';
import { generatePlaceImage, generatePostContent, sendPhotoToChannel, sendMessageToChannel } from '../../src/lib/auto-poster/telegram-poster';

const CHANNEL_ID = process.env.CHANNEL_ID || '-1003809470742';

// Check if user is admin
async function isAdmin(ctx: BotContext): Promise<boolean> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return false;
  const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim());
  return adminIds.includes(telegramId);
}

// Show auto-posting menu
export async function showAutoPostMenu(ctx: BotContext): Promise<void> {
  if (!await isAdmin(ctx)) {
    await ctx.reply('⛔ У вас нет доступа к этой функции.');
    return;
  }

  // Get stats
  const totalPlaces = await prisma.place.count();
  const placesWithReviews = await prisma.place.count({
    where: { reviewCount: { gt: 0 } },
  });

  const message = `
📢 <b>Автопостинг в канал</b>

📊 <b>Статистика:</b>
• Всего заведений: ${totalPlaces}
• С отзывами: ${placesWithReviews}

📢 <b>Канал:</b> ${CHANNEL_ID}

Выберите действие:
  `.trim();

  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text('🎲 Случайный пост', 'autopost_random')
      .text('🏆 ТОП заведений', 'autopost_top')
      .row()
      .text('🍔 Рестораны', 'autopost_cat_RESTAURANT')
      .text('☕ Кофейни', 'autopost_cat_CAFE')
      .row()
      .text('🛍 Магазины', 'autopost_cat_SHOP')
      .text('💅 Бьюти', 'autopost_cat_BEAUTY')
      .row()
      .text('🔙 Меню', 'admin_menu'),
  });
}

// Handle auto-post actions
export async function handleAutoPostAction(ctx: BotContext, action: string, data?: string): Promise<void> {
  if (!await isAdmin(ctx)) {
    await ctx.answerCallbackQuery('⛔ Нет доступа');
    return;
  }

  try {
    if (action === 'random') {
      // Post random place
      await ctx.answerCallbackQuery('⏳ Генерирую пост...');

      const places = await prisma.place.findMany({
        where: { reviewCount: { gte: 1 }, rating: { gte: 5 } },
        orderBy: { rating: 'desc' },
        take: 10,
      });

      if (places.length === 0) {
        const anyPlace = await prisma.place.findFirst();
        if (!anyPlace) {
          await ctx.reply('❌ Нет заведений для публикации.');
          return;
        }

        await publishPlace(ctx, anyPlace);
        return;
      }

      const randomPlace = places[Math.floor(Math.random() * places.length)];
      await publishPlace(ctx, randomPlace);
    } else if (action === 'top') {
      // Post top places digest
      await ctx.answerCallbackQuery('⏳ Генерирую дайджест...');

      const places = await prisma.place.findMany({
        where: { reviewCount: { gte: 1 } },
        orderBy: { rating: 'desc' },
        take: 10,
      });

      await publishDigest(ctx, places, 'ТОП заведений Казани');
    } else if (action.startsWith('cat_')) {
      // Post category digest
      const category = action.replace('cat_', '');
      await ctx.answerCallbackQuery('⏳ Генерирую пост...');

      const categoryNames: Record<string, string> = {
        RESTAURANT: 'Рестораны',
        CAFE: 'Кофейни',
        SHOP: 'Магазины',
        BEAUTY: 'Бьюти-салоны',
        MALL: 'Торговые центры',
        SERVICE: 'Сервисы',
      };

      const places = await prisma.place.findMany({
        where: {
          category: category as any,
          reviewCount: { gt: 0 },
        },
        orderBy: { rating: 'desc' },
        take: 10,
      });

      if (places.length === 0) {
        await ctx.reply('❌ Нет заведений в этой категории с отзывами.');
        return;
      }

      // Post about top place in category
      await publishPlace(ctx, places[0]);
    }
  } catch (error) {
    console.error('Auto-post error:', error);
    await ctx.reply(`❌ Ошибка: ${error}`);
  }
}

// Publish single place
async function publishPlace(ctx: BotContext, place: any): Promise<void> {
  try {
    // Generate content
    const post = await generatePostContent({
      name: place.name,
      category: place.category,
      district: place.district,
      address: place.address,
      rating: place.rating,
      reviewCount: place.reviewCount,
    });

    // Generate image
    await ctx.reply(`⏳ Генерирую изображение для "${place.name}"...`);
    const imageBase64 = await generatePlaceImage(place.name, place.category);

    // Format caption
    const caption = `<b>${post.title}</b>\n\n${post.content}\n\n🤖 @Chest_Kazan_bot`;

    let success = false;

    if (imageBase64) {
      success = await sendPhotoToChannel(imageBase64, caption);
    }

    if (!success) {
      success = await sendMessageToChannel(caption);
    }

    if (success) {
      await ctx.reply(`✅ Пост о "${place.name}" опубликован в канал!`);
    } else {
      await ctx.reply('❌ Ошибка при публикации поста.');
    }
  } catch (error) {
    console.error('Publish error:', error);
    await ctx.reply(`❌ Ошибка публикации: ${error}`);
  }
}

// Publish digest
async function publishDigest(ctx: BotContext, places: any[], title: string): Promise<void> {
  try {
    const placesList = places
      .slice(0, 10)
      .map(
        (p, i) =>
          `${i + 1}. ${p.name}${p.rating ? ` (${p.rating.toFixed(1)}⭐)` : ''}${p.district ? ` - ${p.district}` : ''}`
      )
      .join('\n');

    const content = `<b>🏆 ${title}</b>\n\n${placesList}\n\n📝 Оставьте свой отзыв в боте!\n\n🤖 @Chest_Kazan_bot`;

    // Generate image
    await ctx.reply('⏳ Генерирую изображение...');
    const imageBase64 = await generatePlaceImage(title, 'RESTAURANT');

    let success = false;

    if (imageBase64) {
      success = await sendPhotoToChannel(imageBase64, content);
    }

    if (!success) {
      success = await sendMessageToChannel(content);
    }

    if (success) {
      await ctx.reply(`✅ Дайджест "${title}" опубликован!`);
    } else {
      await ctx.reply('❌ Ошибка при публикации дайджеста.');
    }
  } catch (error) {
    console.error('Digest publish error:', error);
    await ctx.reply(`❌ Ошибка: ${error}`);
  }
}
