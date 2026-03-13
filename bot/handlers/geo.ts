import { BotContext } from '../context';
import { formatPlaceCard, formatDistance, calculateDistance } from '../utils/formatters';
import { getPlaceCardKeyboard, getBackKeyboard } from '../keyboards/main';
import prisma from '../../src/lib/db';

const NEARBY_RADIUS_KM = 5; // 5 km radius
const MAX_NEARBY_PLACES = 10;

// Request user location
export async function requestLocation(ctx: BotContext): Promise<void> {
  await ctx.reply(
    '📍 <b>Поиск заведений рядом</b>\n\n' +
    'Отправьте вашу геолокацию, чтобы найти заведения поблизости.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: '📍 Отправить геолокацию', request_location: true }],
          [{ text: '🔙 Назад' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );
}

// Handle location and find nearby places
export async function handleLocation(ctx: BotContext, latitude: number, longitude: number): Promise<void> {
  // Find all places with coordinates
  const places = await prisma.place.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
  });
  
  if (places.length === 0) {
    await ctx.reply(
      'К сожалению, в базе нет заведений с указанными координатами.\n\n' +
      'Попробуйте поиск по названию или категории.',
      { reply_markup: getBackKeyboard('back_to_menu') }
    );
    return;
  }
  
  // Calculate distances and sort
  const placesWithDistance = places
    .map(place => ({
      ...place,
      distance: calculateDistance(
        latitude,
        longitude,
        place.latitude!,
        place.longitude!
      ),
    }))
    .filter(place => place.distance <= NEARBY_RADIUS_KM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_NEARBY_PLACES);
  
  if (placesWithDistance.length === 0) {
    await ctx.reply(
      `В радиусе ${NEARBY_RADIUS_KM} км от вас не найдено заведений.\n\n` +
      'Попробуйте увеличить радиус поиска или найти заведение по названию.',
      { reply_markup: getBackKeyboard('back_to_menu') }
    );
    return;
  }
  
  // Show results
  let message = `📍 <b>Заведения рядом с вами</b>\n\n`;
  
  placesWithDistance.forEach((place, index) => {
    message += `${index + 1}. <b>${place.name}</b>\n`;
    message += `   📍 ${formatDistance(place.distance)} • ⭐ ${place.rating.toFixed(1)}\n\n`;
  });
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('back_to_menu'),
  });
  
  // Show first place card
  if (placesWithDistance.length > 0) {
    await showPlaceCard(ctx, placesWithDistance[0].id);
  }
}

// Show place card
async function showPlaceCard(ctx: BotContext, placeId: string): Promise<void> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
  });
  
  if (!place) return;
  
  const message = formatPlaceCard(place);
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getPlaceCardKeyboard(placeId),
  });
}

// Set place coordinates (for admin)
export async function setPlaceCoordinates(
  placeId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  await prisma.place.update({
    where: { id: placeId },
    data: { latitude, longitude },
  });
}
