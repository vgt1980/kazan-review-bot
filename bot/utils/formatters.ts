import { Category } from '@prisma/client';
import { 
  CATEGORY_NAMES, 
  CATEGORY_HASHTAGS, 
  USER_STATUS_NAMES, 
  STATUS_THRESHOLDS,
  REVIEW_STATUS_NAMES 
} from '../types';

// Format rating as stars
export function formatRating(rating: number, maxRating: number = 10): string {
  const fullStars = Math.round((rating / maxRating) * 10);
  const halfStar = fullStars % 2 === 1;
  const emptyStars = 10 - fullStars - (halfStar ? 1 : 0);
  
  let result = '⭐'.repeat(Math.floor(fullStars / 2));
  if (halfStar) result += '✨';
  result += '☆'.repeat(Math.floor(emptyStars / 2));
  
  return result;
}

// Format rating as number
export function formatRatingNumber(rating: number): string {
  return `${rating.toFixed(1)}/10`;
}

// Format date
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

// Format date and time
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Format review for channel publication
export function formatReviewForChannel(review: {
  place: { name: string; category: Category; district: string | null };
  overallRating: number;
  foodRating: number | null;
  serviceRating: number | null;
  atmosphereRating: number | null;
  valueRating: number | null;
  text: string;
  user: { username: string | null };
}): string {
  const { place, overallRating, foodRating, serviceRating, atmosphereRating, valueRating, text, user } = review;
  
  let message = `📍 <b>${escapeHtml(place.name)}</b>\n\n`;
  message += `${CATEGORY_NAMES[place.category]}\n`;
  if (place.district) {
    message += `📍 ${place.district}\n`;
  }
  message += `\n⭐ <b>Общая оценка: ${overallRating}/10</b>\n\n`;
  
  message += `<b>Оценки:</b>\n`;
  if (foodRating) message += `🍽 Еда — ${foodRating}\n`;
  if (serviceRating) message += `🤝 Сервис — ${serviceRating}\n`;
  if (atmosphereRating) message += `🏠 Атмосфера — ${atmosphereRating}\n`;
  if (valueRating) message += `💰 Цена/качество — ${valueRating}\n`;
  
  message += `\n💬 <b>Отзыв:</b>\n${escapeHtml(text)}\n`;
  
  if (user.username) {
    message += `\n— @${user.username}`;
  }
  
  message += `\n\n${CATEGORY_HASHTAGS[place.category].join(' ')}`;
  
  return message;
}

// Format review for moderation
export function formatReviewForModeration(review: {
  id: string;
  place: { name: string; category: Category; district: string | null };
  overallRating: number;
  foodRating: number | null;
  serviceRating: number | null;
  atmosphereRating: number | null;
  valueRating: number | null;
  text: string;
  user: { telegramId: string; username: string | null; firstName: string | null };
  createdAt: Date;
}): string {
  const { place, overallRating, foodRating, serviceRating, atmosphereRating, valueRating, text, user, createdAt } = review;
  
  let message = `📝 <b>Новый отзыв на модерации</b>\n\n`;
  message += `👤 <b>Пользователь:</b>\n`;
  message += `   Username: ${user.username ? '@' + user.username : 'не указан'}\n`;
  message += `   Имя: ${user.firstName || 'не указано'}\n`;
  message += `   ID: <code>${user.telegramId}</code>\n\n`;
  
  message += `📍 <b>Заведение:</b> ${escapeHtml(place.name)}\n`;
  message += `📂 <b>Категория:</b> ${CATEGORY_NAMES[place.category]}\n`;
  if (place.district) {
    message += `📍 <b>Район:</b> ${place.district}\n`;
  }
  
  message += `\n⭐ <b>Общая оценка:</b> ${overallRating}/10\n`;
  
  message += `\n<b>Детальные оценки:</b>\n`;
  if (foodRating) message += `🍽 Еда: ${foodRating}/10\n`;
  if (serviceRating) message += `🤝 Сервис: ${serviceRating}/10\n`;
  if (atmosphereRating) message += `🏠 Атмосфера: ${atmosphereRating}/10\n`;
  if (valueRating) message += `💰 Цена/качество: ${valueRating}/10\n`;
  
  message += `\n💬 <b>Текст отзыва:</b>\n${escapeHtml(text)}\n`;
  message += `\n📅 <b>Дата:</b> ${formatDateTime(createdAt)}`;
  
  return message;
}

// Format place card
export function formatPlaceCard(place: {
  name: string;
  category: Category;
  district: string | null;
  rating: number;
  reviewCount: number;
  avgFood: number;
  avgService: number;
  avgAtmosphere: number;
  avgValue: number;
}): string {
  const { name, category, district, rating, reviewCount, avgFood, avgService, avgAtmosphere, avgValue } = place;
  
  let message = `📍 <b>${escapeHtml(name)}</b>\n\n`;
  message += `${CATEGORY_NAMES[category]}\n`;
  if (district) {
    message += `📍 ${district}\n`;
  }
  
  message += `\n⭐ <b>Рейтинг: ${rating.toFixed(1)}/10</b>\n`;
  message += `👥 Отзывов: ${reviewCount}\n`;
  
  if (reviewCount > 0) {
    message += `\n<b>Средние оценки:</b>\n`;
    if (avgFood > 0) message += `🍽 Еда — ${avgFood.toFixed(1)}\n`;
    if (avgService > 0) message += `🤝 Сервис — ${avgService.toFixed(1)}\n`;
    if (avgAtmosphere > 0) message += `🏠 Атмосфера — ${avgAtmosphere.toFixed(1)}\n`;
    if (avgValue > 0) message += `💰 Цена/качество — ${avgValue.toFixed(1)}\n`;
  }
  
  return message;
}

// Format user profile
export function formatUserProfile(user: {
  username: string | null;
  firstName: string | null;
  reviewCount: number;
  helpfulVotes: number;
  status: string;
  createdAt: Date;
}): string {
  const { username, firstName, reviewCount, helpfulVotes, status, createdAt } = user;
  
  let message = `🧑‍💻 <b>Ваш профиль</b>\n\n`;
  
  if (username) {
    message += `👤 @${username}\n`;
  } else if (firstName) {
    message += `👤 ${firstName}\n`;
  }
  
  message += `📊 Статус: ${USER_STATUS_NAMES[status] || status}\n`;
  message += `📝 Отзывов: ${reviewCount}\n`;
  message += `👍 Полезных голосов: ${helpfulVotes}\n`;
  message += `📅 На проекте с: ${formatDate(createdAt)}\n`;
  
  // Show progress to next status
  const thresholds = Object.entries(STATUS_THRESHOLDS);
  for (let i = 0; i < thresholds.length - 1; i++) {
    const [currentStatus, currentThreshold] = thresholds[i];
    const [, nextThreshold] = thresholds[i + 1];
    
    if (user.status === currentStatus && nextThreshold) {
      const remaining = nextThreshold - reviewCount;
      if (remaining > 0) {
        message += `\n📈 До следующего статуса: ${remaining} отзывов`;
      }
      break;
    }
  }
  
  return message;
}

// Format top places list
export function formatTopPlacesList(
  places: { name: string; rating: number; reviewCount: number }[],
  title: string = '🏆 ТОП заведений Казани'
): string {
  let message = `${title}\n\n`;
  
  places.forEach((place, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    message += `${medal} <b>${escapeHtml(place.name)}</b>\n`;
    message += `   ⭐ ${place.rating.toFixed(1)} • 👥 ${place.reviewCount} отзывов\n\n`;
  });
  
  return message;
}

// Format user reviews list
export function formatUserReviewsList(
  reviews: { place: { name: string }; overallRating: number; createdAt: Date; status: string }[]
): string {
  if (reviews.length === 0) {
    return 'У вас пока нет отзывов.';
  }
  
  let message = `📝 <b>Ваши отзывы</b>\n\n`;
  
  reviews.forEach(review => {
    const statusEmoji = review.status === 'APPROVED' ? '✅' : 
                        review.status === 'PENDING' ? '⏳' : '❌';
    message += `${statusEmoji} <b>${escapeHtml(review.place.name)}</b>\n`;
    message += `   ⭐ ${review.overallRating}/10 • ${formatDate(review.createdAt)}\n\n`;
  });
  
  return message;
}

// Calculate distance between two points (in km)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Format distance
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} м`;
  }
  return `${distanceKm.toFixed(1)} км`;
}

// Escape HTML for Telegram
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Generate statistics summary
export function formatStatsSummary(stats: {
  totalUsers: number;
  totalPlaces: number;
  totalReviews: number;
  pendingReviews: number;
  todayReviews: number;
  todayUsers: number;
}): string {
  return `
📊 <b>Статистика проекта</b>

👥 Пользователей: ${stats.totalUsers}
🏪 Заведений: ${stats.totalPlaces}
📝 Отзывов: ${stats.totalReviews}
⏳ На модерации: ${stats.pendingReviews}

<b>Сегодня:</b>
📝 Новых отзывов: ${stats.todayReviews}
👥 Новых пользователей: ${stats.todayUsers}
`.trim();
}
