import { Category, ReviewStatus, ComplaintReason, ComplaintStatus } from '@prisma/client';

// Session data for multi-step review form
export interface ReviewFormData {
  step: ReviewStep;
  category?: Category;
  placeId?: string;
  placeName?: string;
  district?: string;
  address?: string;
  overallRating?: number;
  foodRating?: number;
  serviceRating?: number;
  atmosphereRating?: number;
  valueRating?: number;
  text?: string;
  photos: string[]; // Telegram file_ids
  photoType: 'place' | 'receipt';
}

export enum ReviewStep {
  IDLE = 'IDLE',
  SELECT_CATEGORY = 'SELECT_CATEGORY',
  ENTER_PLACE_NAME = 'ENTER_PLACE_NAME',
  SELECT_PLACE = 'SELECT_PLACE',
  ENTER_ADDRESS = 'ENTER_ADDRESS',
  ENTER_OVERALL_RATING = 'ENTER_OVERALL_RATING',
  ENTER_FOOD_RATING = 'ENTER_FOOD_RATING',
  ENTER_SERVICE_RATING = 'ENTER_SERVICE_RATING',
  ENTER_ATMOSPHERE_RATING = 'ENTER_ATMOSPHERE_RATING',
  ENTER_VALUE_RATING = 'ENTER_VALUE_RATING',
  ENTER_TEXT = 'ENTER_TEXT',
  ADD_PHOTOS = 'ADD_PHOTOS',
  CONFIRMATION = 'CONFIRMATION',
  SUBMITTED = 'SUBMITTED',
}

// Session data for search
export interface SearchSession {
  mode: 'name' | 'category';
  category?: Category;
  query?: string;
  filterRating?: number;
  filterWithPhotos?: boolean;
  filterPopular?: boolean;
}

// Session data for admin
export interface AdminSession {
  mode: 'moderation' | 'users' | 'broadcast' | 'stats' | 'places';
  currentReviewId?: string;
  currentUserId?: string;
  page?: number;
}

// Main session interface
export interface SessionData {
  // Review form
  reviewForm?: ReviewFormData;
  
  // Search
  search?: SearchSession;
  
  // Admin
  admin?: AdminSession;
  
  // Last action timestamp for rate limiting
  lastAction?: number;
  
  // Language
  languageCode?: string;
}

// Category display names
export const CATEGORY_NAMES: Record<Category, string> = {
  RESTAURANT: '🍔 Ресторан',
  CAFE: '☕ Кофейня',
  SHOP: '🛍 Магазин',
  BEAUTY: '💅 Бьюти',
  MALL: '🏬 Торговый центр',
  SERVICE: '🚗 Сервис / услуги',
  OTHER: '📦 Другое',
};

// Category hashtags
export const CATEGORY_HASHTAGS: Record<Category, string[]> = {
  RESTAURANT: ['#рестораны', '#казань'],
  CAFE: ['#кофейни', '#казань'],
  SHOP: ['#магазины', '#казань'],
  BEAUTY: ['#бьюти', '#казань'],
  MALL: ['#тц', '#казань'],
  SERVICE: ['#сервис', '#казань'],
  OTHER: ['#места', '#казань'],
};

// User statuses
export const USER_STATUS_NAMES: Record<string, string> = {
  NOVICE: '🌱 Новичок',
  ACTIVE: '⭐ Активный',
  EXPERT: '🏆 Эксперт',
  TOP_REVIEWER: '👑 Топ-ревизор',
};

// Status thresholds
export const STATUS_THRESHOLDS = {
  NOVICE: 0,
  ACTIVE: 5,
  EXPERT: 20,
  TOP_REVIEWER: 50,
};

// Complaint reason names
export const COMPLAINT_REASONS: Record<ComplaintReason, string> = {
  FALSE_INFO: '❌ Ложная информация',
  INSULTS: '🤬 Оскорбления',
  ADVERTISING: '📢 Реклама',
  OTHER: '📝 Другое',
};

// Review status names
export const REVIEW_STATUS_NAMES: Record<ReviewStatus, string> = {
  PENDING: '⏳ На модерации',
  APPROVED: '✅ Опубликован',
  REJECTED: '❌ Отклонён',
  HIDDEN: '👁 Скрыт',
};
