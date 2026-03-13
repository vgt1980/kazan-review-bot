import { InlineKeyboard } from 'grammy';
import { Review, User, Category } from '@prisma/client';

// Category names for keyboards
const CATEGORY_NAMES: Record<Category, string> = {
  RESTAURANT: '🍔 Ресторан',
  CAFE: '☕ Кофейня',
  SHOP: '🛍 Магазин',
  BEAUTY: '💅 Бьюти',
  MALL: '🏬 Торговый центр',
  SERVICE: '🚗 Сервис / услуги',
  OTHER: '📦 Другое',
};

// Admin menu keyboard
export function getAdminMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📝 Модерация отзывов', 'admin_moderation')
    .text('👥 Пользователи', 'admin_users')
    .row()
    .text('🏪 Заведения', 'admin_places')
    .text('📊 Статистика', 'admin_stats')
    .row()
    .text('📢 Автопостинг', 'admin_autopost')
    .text('📥 Импорт заведений', 'admin_import')
    .row()
    .text('🔙 Выход', 'admin_exit');
}

// Moderation keyboard for pending reviews
export function getModerationKeyboard(reviewId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Опубликовать', `mod_approve_${reviewId}`)
    .text('❌ Отклонить', `mod_reject_${reviewId}`)
    .row()
    .text('✏️ Редактировать', `mod_edit_${reviewId}`)
    .text('🚫 Заблокировать пользователя', `mod_block_user_${reviewId}`)
    .row()
    .text('⏭ Пропустить', `mod_skip_${reviewId}`)
    .text('🔙 Меню', 'admin_menu');
}

// Reject reason keyboard
export function getRejectReasonKeyboard(reviewId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🚫 Спам', `reject_spam_${reviewId}`)
    .text('⚠️ Недостоверная информация', `reject_false_${reviewId}`)
    .row()
    .text('🤬 Оскорбления', `reject_insult_${reviewId}`)
    .text('📢 Реклама', `reject_ads_${reviewId}`)
    .row()
    .text('📝 Другое', `reject_other_${reviewId}`)
    .text('🔙 Назад', `mod_back_${reviewId}`);
}

// User management keyboard
export function getUserManageKeyboard(userId: string, isBlocked: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  if (isBlocked) {
    keyboard.text('✅ Разблокировать', `user_unblock_${userId}`);
  } else {
    keyboard.text('🚫 Заблокировать', `user_block_${userId}`);
  }
  
  keyboard.row()
    .text('📋 Отзывы пользователя', `user_reviews_${userId}`)
    .text('🔙 Назад', 'admin_users');
  
  return keyboard;
}

// User list keyboard
export function getUserListKeyboard(
  users: { id: string; telegramId: string; username: string | null }[],
  page: number,
  totalPages: number
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  users.forEach(user => {
    const displayName = user.username ? `@${user.username}` : `ID: ${user.telegramId}`;
    keyboard.text(displayName.substring(0, 25), `user_view_${user.id}`);
    keyboard.row();
  });
  
  // Pagination
  if (totalPages > 1) {
    if (page > 1) {
      keyboard.text('◀️', `users_page_${page - 1}`);
    }
    keyboard.text(`${page}/${totalPages}`, 'page_info');
    if (page < totalPages) {
      keyboard.text('▶️', `users_page_${page + 1}`);
    }
    keyboard.row();
  }
  
  keyboard.text('🔙 Меню', 'admin_menu');
  
  return keyboard;
}

// Review list keyboard
export function getReviewListKeyboard(
  reviews: { id: string; placeName: string; status: string }[],
  page: number,
  totalPages: number,
  prefix: string = 'review'
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  reviews.forEach(review => {
    const statusEmoji = review.status === 'APPROVED' ? '✅' : 
                        review.status === 'PENDING' ? '⏳' : 
                        review.status === 'REJECTED' ? '❌' : '👁';
    keyboard.text(`${statusEmoji} ${review.placeName.substring(0, 20)}`, `${prefix}_${review.id}`);
    keyboard.row();
  });
  
  // Pagination
  if (totalPages > 1) {
    if (page > 1) {
      keyboard.text('◀️', `${prefix}s_page_${page - 1}`);
    }
    keyboard.text(`${page}/${totalPages}`, 'page_info');
    if (page < totalPages) {
      keyboard.text('▶️', `${prefix}s_page_${page + 1}`);
    }
    keyboard.row();
  }
  
  keyboard.text('🔙 Меню', 'admin_menu');
  
  return keyboard;
}

// Broadcast keyboard
export function getBroadcastKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📝 Новая рассылка', 'broadcast_new')
    .text('📋 История', 'broadcast_history')
    .row()
    .text('🔙 Меню', 'admin_menu');
}

// Broadcast confirmation keyboard
export function getBroadcastConfirmKeyboard(broadcastId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Отправить', `broadcast_send_${broadcastId}`)
    .text('✏️ Редактировать', `broadcast_edit_${broadcastId}`)
    .row()
    .text('❌ Отмена', 'broadcast_cancel');
}

// Place management keyboard
export function getPlaceManageKeyboard(placeId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✏️ Редактировать', `place_edit_${placeId}`)
    .text('🗑 Удалить', `place_delete_${placeId}`)
    .row()
    .text('📊 Статистика', `place_stats_${placeId}`)
    .text('🔙 Назад', 'admin_places');
}

// Statistics keyboard
export function getStatsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📈 Общая', 'stats_general')
    .text('📊 По категориям', 'stats_categories')
    .row()
    .text('👥 Пользователи', 'stats_users')
    .text('📝 Отзывы', 'stats_reviews')
    .row()
    .text('🔙 Меню', 'admin_menu');
}

// ==================== PLACE MANAGEMENT ====================

// Places admin keyboard with add button
export function getPlacesAdminKeyboard(page: number, totalPages: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  // Add place button
  keyboard.text('➕ Добавить заведение', 'admin_add_place');
  keyboard.row();
  
  // Pagination if needed
  if (totalPages > 1) {
    if (page > 1) {
      keyboard.text('◀️', `places_page_${page - 1}`);
    }
    keyboard.text(`${page}/${totalPages}`, 'page_info');
    if (page < totalPages) {
      keyboard.text('▶️', `places_page_${page + 1}`);
    }
    keyboard.row();
  }
  
  keyboard.text('🔙 Меню', 'admin_menu');
  
  return keyboard;
}

// Add place - category selection
export function getAddPlaceCategoryKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  Object.entries(CATEGORY_NAMES).forEach(([key, name]) => {
    keyboard.text(name, `add_place_cat_${key}`);
    keyboard.row();
  });
  
  keyboard.text('❌ Отмена', 'admin_cancel_add');
  
  return keyboard;
}

// Add place confirmation
export function getAddPlaceConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Добавить', 'admin_confirm_place')
    .text('✏️ Изменить', 'admin_edit_place')
    .row()
    .text('❌ Отмена', 'admin_cancel_add');
}

// ==================== AUTO-POSTING ====================

// Auto-posting menu keyboard
export function getAutoPostMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🎲 Случайный пост', 'autopost_random')
    .text('🏆 ТОП заведений', 'autopost_top')
    .row()
    .text('🍔 Рестораны', 'autopost_cat_RESTAURANT')
    .text('☕ Кофейни', 'autopost_cat_CAFE')
    .row()
    .text('🛍 Магазины', 'autopost_cat_SHOP')
    .text('💅 Бьюти', 'autopost_cat_BEAUTY')
    .row()
    .text('📰 RSS новости', 'autopost_rss')
    .text('⚙️ Настройки', 'autopost_settings')
    .row()
    .text('🔙 Меню', 'admin_menu');
}

// RSS news menu keyboard
export function getRSSMenuKeyboard(itemsCount: number = 0): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 Загрузить новости', 'rss_fetch')
    .text('📢 Опубликовать свежую', 'rss_publish_latest')
    .row()
    .text('🔙 Назад', 'admin_autopost');
}

// Import menu keyboard
export function getImportMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📥 Импорт из OpenStreetMap', 'import_osm')
    .row()
    .text('🍔 Рестораны', 'import_cat_RESTAURANT')
    .text('☕ Кофейни', 'import_cat_CAFE')
    .row()
    .text('🛍 Магазины', 'import_cat_SHOP')
    .text('💅 Бьюти', 'import_cat_BEAUTY')
    .row()
    .text('🚗 Сервисы', 'import_cat_SERVICE')
    .text('📥 Импортировать всё', 'import_all')
    .row()
    .text('📊 Статистика', 'import_stats')
    .text('🔙 Меню', 'admin_menu');
}
