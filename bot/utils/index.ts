import { CATEGORIES, USER_STATUS } from "../context";

// Format rating as stars
export function formatStars(rating: number, maxRating: number = 10): string {
  const fullStars = Math.floor(rating / 2);
  const halfStar = rating % 2 >= 1;
  const emptyStars = Math.floor((maxRating - rating) / 2);

  let stars = "⭐".repeat(fullStars);
  if (halfStar) stars += "✨";
  stars += "☆".repeat(emptyStars);

  return stars;
}

// Format rating as number with color indicator
export function formatRating(rating: number): string {
  if (rating >= 8) return `🟢 ${rating}/10`;
  if (rating >= 5) return `🟡 ${rating}/10`;
  return `🔴 ${rating}/10`;
}

// Format date for display
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// Format short date
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(date);
}

// Format review text with truncation
export function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// Format user status
export function formatUserStatus(status: string): string {
  const statusMap: Record<string, string> = {
    novice: "🆕 Новичок",
    active: "👤 Активный",
    expert: "⭐ Эксперт",
    top_reviewer: "👑 ТОП рецензент",
  };
  return statusMap[status] || status;
}

// Get user status based on review count
export function getUserStatus(reviewCount: number): string {
  if (reviewCount >= 50) return USER_STATUS.TOP_REVIEWER;
  if (reviewCount >= 20) return USER_STATUS.EXPERT;
  if (reviewCount >= 5) return USER_STATUS.ACTIVE;
  return USER_STATUS.NOVICE;
}

// Format category name
export function formatCategory(category: string): string {
  return CATEGORIES[category as keyof typeof CATEGORIES] || category;
}

// Format place card
export function formatPlaceCard(place: {
  name: string;
  category: string;
  address?: string | null;
  rating: number;
  reviewCount: number;
}): string {
  const lines = [
    `📍 <b>${place.name}</b>`,
    `${formatCategory(place.category)}`,
    place.address ? `📍 ${place.address}` : null,
    `${formatRating(place.rating)} (${place.reviewCount} отзывов)`,
  ].filter(Boolean);

  return lines.join("\n");
}

// Format review preview
export function formatReviewPreview(review: {
  category: string;
  placeName: string;
  district?: string;
  overallRating: number;
  foodRating?: number;
  serviceRating?: number;
  atmosphereRating?: number;
  valueRating?: number;
  text: string;
  photosCount?: number;
}): string {
  const lines = [
    "📝 <b>Предпросмотр отзыва</b>",
    "",
    `📂 Категория: ${formatCategory(review.category)}`,
    `📍 Место: ${review.placeName}`,
    review.district ? `🗺️ Район: ${review.district}` : null,
    "",
    `<b>Оценки:</b>`,
    `   Общая: ${formatRating(review.overallRating)}`,
    review.foodRating ? `   Еда: ${formatRating(review.foodRating)}` : null,
    review.serviceRating ? `   Сервис: ${formatRating(review.serviceRating)}` : null,
    review.atmosphereRating ? `   Атмосфера: ${formatRating(review.atmosphereRating)}` : null,
    review.valueRating ? `   Цена/Качество: ${formatRating(review.valueRating)}` : null,
    "",
    `<b>Текст отзыва:</b>`,
    review.text,
    review.photosCount ? `\n📷 Фото: ${review.photosCount} шт.` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

// Validation functions

// Validate text length
export function validateTextLength(text: string, minLength: number = 20): boolean {
  return text.trim().length >= minLength;
}

// Validate rating range
export function validateRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 10;
}

// Parse rating from text
export function parseRating(text: string): number | null {
  const num = parseInt(text, 10);
  if (validateRating(num)) return num;
  return null;
}

// Validate place name
export function validatePlaceName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
}

// Sanitize text for HTML
export function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Calculate average rating
export function calculateAverageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

// Calculate weighted rating (Wilson score interval)
export function calculateWeightedRating(
  positiveVotes: number,
  totalVotes: number,
  confidence: number = 1.96
): number {
  if (totalVotes === 0) return 0;

  const phat = positiveVotes / totalVotes;
  const z = confidence;
  const n = totalVotes;

  const numerator = phat + (z * z) / (2 * n) - z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n);
  const denominator = 1 + (z * z) / n;

  return Math.round((numerator / denominator) * 10 * 10) / 10;
}

// Escape MarkdownV2 characters
export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// Format moderation message
export function formatModerationMessage(review: {
  id: string;
  user: { firstName?: string | null; lastName?: string | null; username?: string | null };
  place: { name: string; category: string };
  overallRating: number;
  text: string;
  photos?: { fileId: string }[];
}): string {
  const userName = [review.user.firstName, review.user.lastName].filter(Boolean).join(" ") || review.user.username || "Пользователь";
  const photosCount = review.photos?.length || 0;

  return [
    "🔔 <b>Новый отзыв на модерацию</b>",
    "",
    `👤 Автор: ${sanitizeHtml(userName)}`,
    `📍 Место: ${sanitizeHtml(review.place.name)} (${formatCategory(review.place.category)})`,
    `⭐ Оценка: ${review.overallRating}/10`,
    "",
    `<b>Текст:</b>`,
    sanitizeHtml(truncateText(review.text, 500)),
    photosCount > 0 ? `\n📷 Фото: ${photosCount} шт.` : "",
    "",
    `ID: ${review.id}`,
  ].join("\n");
}

// Format complaint message
export function formatComplaintMessage(complaint: {
  id: string;
  reason: string;
  description?: string | null;
  review: {
    text: string;
    overallRating: number;
    place: { name: string };
  };
  user: { firstName?: string | null; lastName?: string | null; username?: string | null };
}): string {
  const userName = [complaint.user.firstName, complaint.user.lastName].filter(Boolean).join(" ") || complaint.user.username || "Пользователь";
  const reasonMap: Record<string, string> = {
    false_info: "📛 Недостоверная информация",
    insults: "😤 Оскорбления",
    advertising: "📢 Реклама",
    other: "❓ Другое",
  };

  return [
    "🚨 <b>Новая жалоба</b>",
    "",
    `👤 От: ${sanitizeHtml(userName)}`,
    `📍 Место: ${sanitizeHtml(complaint.review.place.name)}`,
    `📊 Причина: ${reasonMap[complaint.reason] || complaint.reason}`,
    complaint.description ? `📝 ${sanitizeHtml(complaint.description)}` : null,
    "",
    `<b>Отзыв:</b>`,
    sanitizeHtml(truncateText(complaint.review.text, 300)),
    "",
    `ID жалобы: ${complaint.id}`,
  ].filter(Boolean).join("\n");
}
