import { BotContext } from '../context';
import { InlineKeyboard } from 'grammy';
import prisma from '../../src/lib/db';
import {
  fetchRestaurantsFromOSM,
  fetchCafesFromOSM,
  fetchShopsFromOSM,
  fetchBeautyFromOSM,
  fetchServicesFromOSM,
  mapOSMToCategory,
  formatOSMAddress,
  type OSMPlace,
} from '../../src/lib/data-sources/openstreetmap';

// Check if user is admin
async function isAdmin(ctx: BotContext): Promise<boolean> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return false;
  const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim());
  return adminIds.includes(telegramId);
}

// Show import menu
export async function showImportMenu(ctx: BotContext): Promise<void> {
  if (!await isAdmin(ctx)) {
    await ctx.reply('⛔ У вас нет доступа к этой функции.');
    return;
  }

  // Get current stats
  const totalPlaces = await prisma.place.count();
  const byCategory = await prisma.place.groupBy({
    by: ['category'],
    _count: { id: true },
  });

  const categoryStats = byCategory
    .map(c => `${getCategoryEmoji(c.category)} ${c._count.id}`)
    .join(' | ');

  const message = `
📥 <b>Импорт заведений</b>

📊 <b>Текущая база:</b> ${totalPlaces} заведений
${categoryStats}

<b>Доступные источники:</b>
• <b>OpenStreetMap</b> — бесплатная карта

⚠️ <i>Импорт может занять несколько минут</i>
  `.trim();

  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text('📥 Импорт из OSM', 'import_osm_all')
      .text('📊 Статистика OSM', 'import_osm_stats')
      .row()
      .text('🍔 Рестораны', 'import_osm_RESTAURANT')
      .text('☕ Кофейни', 'import_osm_CAFE')
      .row()
      .text('🛍 Магазины', 'import_osm_SHOP')
      .text('💅 Бьюти', 'import_osm_BEAUTY')
      .row()
      .text('🚗 Сервисы', 'import_osm_SERVICE')
      .text('🔄 Проверить дубли', 'import_check_dup')
      .row()
      .text('🔙 Меню', 'admin_menu'),
  });
}

// Handle import action
export async function handleImportAction(ctx: BotContext, action: string): Promise<void> {
  if (!await isAdmin(ctx)) {
    await ctx.answerCallbackQuery('⛔ Нет доступа');
    return;
  }

  try {
    if (action === 'osm_stats') {
      await ctx.answerCallbackQuery('⏳ Загружаю статистику...');

      await ctx.reply('⏳ Загружаю данные из OpenStreetMap...');

      const [restaurants, cafes, shops, beauty, services] = await Promise.all([
        fetchRestaurantsFromOSM(),
        fetchCafesFromOSM(),
        fetchShopsFromOSM(),
        fetchBeautyFromOSM(),
        fetchServicesFromOSM(),
      ]);

      const message = `
📊 <b>Статистика OpenStreetMap (Казань)</b>

🍔 Рестораны: ${restaurants.length}
☕ Кофейни: ${cafes.length}
🛍 Магазины: ${shops.length}
💅 Бьюти: ${beauty.length}
🚗 Сервисы: ${services.length}

<b>Итого:</b> ${restaurants.length + cafes.length + shops.length + beauty.length + services.length} заведений
      `.trim();

      await ctx.reply(message, { parse_mode: 'HTML' });
    } else if (action === 'osm_all') {
      await importAllFromOSM(ctx);
    } else if (action.startsWith('osm_')) {
      const category = action.replace('osm_', '');
      await importCategoryFromOSM(ctx, category);
    } else if (action === 'check_dup') {
      await checkDuplicates(ctx);
    }
  } catch (error) {
    console.error('Import error:', error);
    await ctx.reply(`❌ Ошибка: ${error}`);
  }
}

// Import all categories from OSM
async function importAllFromOSM(ctx: BotContext): Promise<void> {
  await ctx.reply('⏳ Начинаю импорт всех заведений из OpenStreetMap...\nЭто может занять несколько минут.');

  const [restaurants, cafes, shops, beauty, services] = await Promise.all([
    fetchRestaurantsFromOSM(),
    fetchCafesFromOSM(),
    fetchShopsFromOSM(),
    fetchBeautyFromOSM(),
    fetchServicesFromOSM(),
  ]);

  const allPlaces = [...restaurants, ...cafes, ...shops, ...beauty, ...services];

  const result = await importPlaces(allPlaces, null);

  await ctx.reply(
    `✅ <b>Импорт завершён!</b>\n\n` +
    `📥 Добавлено: ${result.added}\n` +
    `⏭️ Пропущено (дубли): ${result.skipped}\n` +
    `📊 Всего обработано: ${result.total}`,
    { parse_mode: 'HTML' }
  );
}

// Import specific category from OSM
async function importCategoryFromOSM(ctx: BotContext, category: string): Promise<void> {
  await ctx.reply(`⏳ Импортирую заведения категории ${category}...`);

  let places: OSMPlace[] = [];

  switch (category) {
    case 'RESTAURANT':
      places = await fetchRestaurantsFromOSM();
      break;
    case 'CAFE':
      places = await fetchCafesFromOSM();
      break;
    case 'SHOP':
      places = await fetchShopsFromOSM();
      break;
    case 'BEAUTY':
      places = await fetchBeautyFromOSM();
      break;
    case 'SERVICE':
      places = await fetchServicesFromOSM();
      break;
  }

  const result = await importPlaces(places, category);

  await ctx.reply(
    `✅ <b>Импорт ${category} завершён!</b>\n\n` +
    `📥 Добавлено: ${result.added}\n` +
    `⏭️ Пропущено: ${result.skipped}\n` +
    `📊 Всего найдено: ${result.total}`,
    { parse_mode: 'HTML' }
  );
}

// Import places to database
async function importPlaces(
  osmPlaces: OSMPlace[],
  category: string | null
): Promise<{ added: number; skipped: number; total: number }> {
  let added = 0;
  let skipped = 0;

  // Map Kazan districts based on coordinates
  const getDistrict = (lat: number, lon: number): string => {
    if (lat > 55.78 && lon < 49.15) return 'Вахитовский';
    if (lat > 55.78 && lon >= 49.15) return 'Приволжский';
    if (lat <= 55.78 && lon < 49.15) return 'Московский';
    return 'Вахитовский';
  };

  for (const place of osmPlaces) {
    // Check if already exists
    const existing = await prisma.place.findFirst({
      where: {
        name: place.name,
        address: formatOSMAddress(place),
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const placeCategory = category || mapOSMToCategory(place);

    try {
      await prisma.place.create({
        data: {
          name: place.name,
          category: placeCategory as any,
          district: place.addr_city || getDistrict(place.lat, place.lon),
          address: formatOSMAddress(place),
          latitude: place.lat,
          longitude: place.lon,
        },
      });
      added++;
    } catch (e) {
      skipped++;
    }
  }

  return {
    added,
    skipped,
    total: osmPlaces.length,
  };
}

// Check for duplicates
async function checkDuplicates(ctx: BotContext): Promise<void> {
  await ctx.reply('⏳ Проверяю дубликаты...');

  const places = await prisma.place.findMany({
    select: { id: true, name: true, address: true },
  });

  const seen: Map<string, string[]> = new Map();
  const duplicates: string[][] = [];

  for (const place of places) {
    const key = `${place.name}|${place.address || ''}`.toLowerCase();
    if (seen.has(key)) {
      seen.get(key)!.push(place.id);
    } else {
      seen.set(key, [place.id]);
    }
  }

  for (const [, ids] of seen) {
    if (ids.length > 1) {
      duplicates.push(ids);
    }
  }

  if (duplicates.length === 0) {
    await ctx.reply('✅ Дубликатов не найдено!');
    return;
  }

  const message = `
⚠️ <b>Найдено дубликатов:</b> ${duplicates.length}

${duplicates.slice(0, 10).map((ids, i) => `• Группа ${i + 1}: ${ids.length} записей`).join('\n')}

${duplicates.length > 10 ? `\n... и ещё ${duplicates.length - 10} групп` : ''}
  `.trim();

  await ctx.reply(message, { parse_mode: 'HTML' });
}

// Helper function to get category emoji
function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    RESTAURANT: '🍔',
    CAFE: '☕',
    SHOP: '🛍',
    BEAUTY: '💅',
    MALL: '🏬',
    SERVICE: '🚗',
    OTHER: '📦',
  };
  return emojis[category] || '📍';
}
