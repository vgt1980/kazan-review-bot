import { InlineKeyboard, Keyboard } from "grammy";
import { CATEGORIES, DISTRICTS } from "../context";

// Main menu keyboard
export function getMainMenuKeyboard() {
  return new Keyboard()
    .text("✍️ Оставить отзыв")
    .text("🔎 Найти отзывы")
    .row()
    .text("🏆 Топ мест")
    .text("📍 Рядом")
    .row()
    .text("👤 Профиль")
    .text("ℹ️ О боте")
    .resized()
    .oneTime();
}

// Category selection keyboard
export function getCategoryKeyboard() {
  const keyboard = new Keyboard();

  Object.values(CATEGORIES).forEach((category, index) => {
    if (index > 0 && index % 2 === 0) {
      keyboard.row();
    }
    keyboard.text(category);
  });

  keyboard.row().text("❌ Отмена");
  return keyboard.resized().oneTime();
}

// Category selection inline keyboard (for callbacks)
export function getCategoryInlineKeyboard(prefix: string = "cat") {
  const keyboard = new InlineKeyboard();

  Object.entries(CATEGORIES).forEach(([key, label], index) => {
    if (index > 0 && index % 2 === 0) {
      keyboard.row();
    }
    keyboard.text(label, `${prefix}:${key}`);
  });

  return keyboard;
}

// District selection keyboard
export function getDistrictKeyboard() {
  const keyboard = new Keyboard();

  DISTRICTS.forEach((district, index) => {
    if (index > 0 && index % 2 === 0) {
      keyboard.row();
    }
    keyboard.text(district);
  });

  keyboard.row().text("⏭ Пропустить").text("❌ Отмена");
  return keyboard.resized().oneTime();
}

// Rating keyboard (1-10)
export function getRatingKeyboard(prefix: string = "rate") {
  const keyboard = new InlineKeyboard();

  for (let i = 1; i <= 10; i++) {
    if (i > 1 && (i - 1) % 5 === 0) {
      keyboard.row();
    }
    keyboard.text(`${i}⭐`, `${prefix}:${i}`);
  }

  return keyboard;
}

// Photo options keyboard
export function getPhotoOptionsKeyboard() {
  return new Keyboard()
    .text("📎 Добавить фото")
    .text("📷 Добавить чек")
    .row()
    .text("✅ Готово")
    .text("⏭ Пропустить")
    .resized()
    .oneTime();
}

// Confirmation keyboard
export function getConfirmationKeyboard() {
  return new InlineKeyboard()
    .text("✅ Отправить", "confirm:send")
    .text("✏️ Изменить", "confirm:edit")
    .row()
    .text("❌ Отмена", "confirm:cancel");
}

// Edit options keyboard
export function getEditOptionsKeyboard() {
  return new InlineKeyboard()
    .text("📝 Текст", "edit:text")
    .text("⭐ Оценки", "edit:ratings")
    .row()
    .text("📷 Фото", "edit:photos")
    .text("📍 Место", "edit:place")
    .row()
    .text("◀️ Назад", "edit:back");
}

// Cancel keyboard
export function getCancelKeyboard() {
  return new Keyboard().text("❌ Отмена").resized().oneTime();
}

// Back to menu keyboard
export function getBackKeyboard() {
  return new Keyboard().text("◀️ В меню").resized().oneTime();
}

// Admin menu keyboard
export function getAdminMenuKeyboard() {
  return new Keyboard()
    .text("📝 На модерации")
    .text("🚨 Жалобы")
    .row()
    .text("👥 Пользователи")
    .text("📍 Места")
    .row()
    .text("📊 Статистика")
    .text("📢 Рассылка")
    .row()
    .text("◀️ В меню")
    .resized();
}

// Moderation keyboard
export function getModerationKeyboard(reviewId: string) {
  return new InlineKeyboard()
    .text("✅ Одобрить", `mod:approve:${reviewId}`)
    .text("❌ Отклонить", `mod:reject:${reviewId}`)
    .row()
    .text("✏️ Редактировать", `mod:edit:${reviewId}`)
    .text("🚫 Заблокировать пользователя", `mod:block:${reviewId}`);
}

// Complaint action keyboard
export function getComplaintActionKeyboard(complaintId: string, reviewId: string) {
  return new InlineKeyboard()
    .text("🚫 Удалить отзыв", `complaint:delete:${complaintId}:${reviewId}`)
    .text("⚠️ Предупреждение", `complaint:warn:${complaintId}`)
    .row()
    .text("✅ Отклонить жалобу", `complaint:dismiss:${complaintId}`)
    .text("🚫 Заблокировать автора", `complaint:block:${complaintId}`);
}

// Vote keyboard
export function getVoteKeyboard(reviewId: string, userVote?: string) {
  const keyboard = new InlineKeyboard();

  const upText = userVote === "up" ? "👍" : "👍";
  const downText = userVote === "down" ? "👎" : "👎";

  keyboard.text(upText, `vote:up:${reviewId}`);
  keyboard.text(downText, `vote:down:${reviewId}`);
  keyboard.text("🚨 Пожаловаться", `complain:${reviewId}`);

  return keyboard;
}

// Search filter keyboard
export function getSearchFilterKeyboard() {
  return new InlineKeyboard()
    .text("⭐ По рейтингу", "filter:rating")
    .text("📷 С фото", "filter:photos")
    .row()
    .text("🔥 Популярные", "filter:popular")
    .text("📅 По дате", "filter:date");
}

// Place actions keyboard
export function getPlaceActionsKeyboard(placeId: string) {
  return new InlineKeyboard()
    .text("📝 Оставить отзыв", `place:review:${placeId}`)
    .text("📍 На карте", `place:map:${placeId}`)
    .row()
    .text("⭐ В избранное", `place:favorite:${placeId}`);
}

// Subscription keyboard
export function getSubscriptionKeyboard(subscribedCategories: string[] = []) {
  const keyboard = new InlineKeyboard();

  Object.entries(CATEGORIES).forEach(([key, label]) => {
    const isSubscribed = subscribedCategories.includes(key);
    const text = isSubscribed ? `✅ ${label}` : label;
    keyboard.text(text, `sub:${key}`).row();
  });

  keyboard.text("✅ Готово", "sub:done");
  return keyboard;
}

// Pagination keyboard
export function getPaginationKeyboard(
  prefix: string,
  currentPage: number,
  totalPages: number,
  extraButtons?: Array<{ text: string; callback: string }>
) {
  const keyboard = new InlineKeyboard();

  if (currentPage > 1) {
    keyboard.text("◀️", `${prefix}:page:${currentPage - 1}`);
  }

  keyboard.text(`${currentPage}/${totalPages}`, "noop");

  if (currentPage < totalPages) {
    keyboard.text("▶️", `${prefix}:page:${currentPage + 1}`);
  }

  if (extraButtons) {
    extraButtons.forEach((btn) => {
      keyboard.row().text(btn.text, btn.callback);
    });
  }

  return keyboard;
}

// Back inline keyboard
export function getBackInlineKeyboard(callback: string) {
  return new InlineKeyboard().text("◀️ Назад", callback);
}

// Broadcast confirmation keyboard
export function getBroadcastConfirmKeyboard() {
  return new InlineKeyboard()
    .text("✅ Отправить", "broadcast:confirm")
    .text("❌ Отмена", "broadcast:cancel");
}
