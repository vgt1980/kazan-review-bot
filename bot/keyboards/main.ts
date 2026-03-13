import { InlineKeyboard, Keyboard } from 'grammy';
import { Category, ReviewStatus } from '@prisma/client';
import { CATEGORY_NAMES, ReviewStep, COMPLAINT_REASONS } from '../types';

// Main menu keyboard (Reply)
export function getMainMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text('✍️ Оставить отзыв')
    .text('🔎 Найти отзывы')
    .row()
    .text('🏆 Рейтинг заведений')
    .text('📍 Найти рядом')
    .row()
    .text('🧑‍💻 Мой профиль')
    .text('ℹ️ О проекте')
    .resized()
    .oneTime(false);
}

// Category selection keyboard
export function getCategoryKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(CATEGORY_NAMES.RESTAURANT, `category_${Category.RESTAURANT}`)
    .text(CATEGORY_NAMES.CAFE, `category_${Category.CAFE}`)
    .row()
    .text(CATEGORY_NAMES.SHOP, `category_${Category.SHOP}`)
    .text(CATEGORY_NAMES.BEAUTY, `category_${Category.BEAUTY}`)
    .row()
    .text(CATEGORY_NAMES.MALL, `category_${Category.MALL}`)
    .text(CATEGORY_NAMES.SERVICE, `category_${Category.SERVICE}`)
    .row()
    .text(CATEGORY_NAMES.OTHER, `category_${Category.OTHER}`);
}

// Rating keyboard (1-10)
export function getRatingKeyboard(action: string, prefix: string = 'rate'): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  // Row 1: 1-5
  for (let i = 1; i <= 5; i++) {
    keyboard.text(`${i}⭐`, `${prefix}_${i}`);
  }
  keyboard.row();
  
  // Row 2: 6-10
  for (let i = 6; i <= 10; i++) {
    keyboard.text(`${i}⭐`, `${prefix}_${i}`);
  }
  
  return keyboard;
}

// Skip button
export function getSkipKeyboard(callbackData: string = 'skip'): InlineKeyboard {
  return new InlineKeyboard().text('⏭ Пропустить', callbackData);
}

// Confirm/Edit/Cancel keyboard
export function getConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Отправить', 'confirm_review')
    .text('✏️ Изменить', 'edit_review')
    .row()
    .text('❌ Отмена', 'cancel_review');
}

// Photo options keyboard
export function getPhotoKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📎 Добавить фото', 'add_photo')
    .text('🧾 Фото чека', 'add_receipt')
    .row()
    .text('✅ Готово', 'photos_done')
    .text('⏭ Пропустить', 'skip_photos');
}

// More photos keyboard
export function getMorePhotosKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📎 Ещё фото', 'add_more_photos')
    .text('✅ Готово', 'photos_done');
}

// Place selection keyboard (for search results)
export function getPlaceSelectionKeyboard(places: { id: string; name: string }[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  places.forEach((place, index) => {
    keyboard.text(place.name.substring(0, 30), `select_place_${place.id}`);
    if ((index + 1) % 2 === 0) keyboard.row();
  });
  
  keyboard.row().text('❌ Это другое место', 'new_place');
  
  return keyboard;
}

// Places list keyboard with pagination (for review flow)
export function getPlacesListKeyboard(
  places: { id: string; name: string; rating?: number; reviewCount?: number }[],
  page: number,
  totalPages: number,
  category: Category
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  // Place buttons (2 per row)
  places.forEach((place, index) => {
    let buttonText = place.name.substring(0, 25);
    if (place.name.length > 25) buttonText += '...';
    
    keyboard.text(buttonText, `select_place_${place.id}`);
    
    // New row every 2 buttons
    if ((index + 1) % 2 === 0) {
      keyboard.row();
    }
  });
  
  // If odd number of places, ensure we're on a new row
  if (places.length % 2 !== 0) {
    keyboard.row();
  }
  
  // Pagination row
  if (totalPages > 1) {
    if (page > 1) {
      keyboard.text('◀️', `places_${category}_${page - 1}`);
    }
    
    keyboard.text(`${page}/${totalPages}`, 'page_info');
    
    if (page < totalPages) {
      keyboard.text('▶️', `places_${category}_${page + 1}`);
    }
    keyboard.row();
  }
  
  // Cancel button
  keyboard.text('❌ Отмена', 'cancel_review');
  
  return keyboard;
}

// Place card keyboard
export function getPlaceCardKeyboard(placeId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('📖 Читать отзывы', `place_reviews_${placeId}`)
    .text('✍️ Написать отзыв', `write_review_${placeId}`)
    .row()
    .text('📊 Статистика', `place_stats_${placeId}`)
    .text('📷 Фото', `place_photos_${placeId}`);
}

// Review vote keyboard
export function getReviewVoteKeyboard(reviewId: string, upvotes: number, downvotes: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(`👍 ${upvotes}`, `vote_up_${reviewId}`)
    .text(`👎 ${downvotes}`, `vote_down_${reviewId}`)
    .row()
    .text('🚩 Пожаловаться', `complain_${reviewId}`);
}

// Complaint reasons keyboard
export function getComplaintReasonKeyboard(reviewId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  Object.entries(COMPLAINT_REASONS).forEach(([key, name]) => {
    keyboard.text(name, `complaint_${key}_${reviewId}`);
    keyboard.row();
  });
  
  keyboard.text('❌ Отмена', 'cancel_complaint');
  
  return keyboard;
}

// Back to menu button
export function getBackKeyboard(callbackData: string = 'back_to_menu'): InlineKeyboard {
  return new InlineKeyboard().text('🔙 Назад', callbackData);
}

// Pagination keyboard
export function getPaginationKeyboard(
  page: number,
  totalPages: number,
  prefix: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  if (page > 1) {
    keyboard.text('◀️ Назад', `${prefix}_${page - 1}`);
  }
  
  keyboard.text(`${page}/${totalPages}`, 'current_page');
  
  if (page < totalPages) {
    keyboard.text('Вперёд ▶️', `${prefix}_${page + 1}`);
  }
  
  return keyboard;
}

// Search filter keyboard
export function getSearchFilterKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⭐ По рейтингу', 'filter_rating')
    .text('📷 С фото', 'filter_photos')
    .row()
    .text('👍 Популярные', 'filter_popular')
    .text('🔄 Сбросить', 'filter_reset')
    .row()
    .text('🔍 Поиск', 'search_execute')
    .text('🔙 Меню', 'back_to_menu');
}

// Category filter keyboard for search
export function getCategoryFilterKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  Object.entries(CATEGORY_NAMES).forEach(([key, name]) => {
    keyboard.text(name, `search_cat_${key}`);
    keyboard.row();
  });
  
  keyboard.text('🔙 Назад', 'back_to_search');
  
  return keyboard;
}

// Subscription keyboard
export function getSubscriptionKeyboard(subscriptions: Category[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  Object.entries(CATEGORY_NAMES).forEach(([key, name]) => {
    const isSubscribed = subscriptions.includes(key as Category);
    const text = isSubscribed ? `✅ ${name}` : name;
    keyboard.text(text, `sub_${key}`);
    keyboard.row();
  });
  
  keyboard.text('🔙 Назад', 'back_to_profile');
  
  return keyboard;
}
