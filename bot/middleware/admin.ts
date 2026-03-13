import { MiddlewareFn } from "grammy";
import { BotContext } from "../context";
import { isAdmin } from "../utils/db";

// Admin middleware - checks if user is admin
export const adminMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  if (!ctx.from) {
    return next();
  }

  const telegramId = ctx.from.id.toString();

  // Check if user is admin
  const adminStatus = await isAdmin(telegramId);

  if (!adminStatus) {
    await ctx.reply("⛔ У вас нет доступа к этой команде.");
    return;
  }

  ctx.isAdmin = true;
  return next();
};

// Extend context with admin flag
declare module "grammy" {
  interface Context {
    isAdmin?: boolean;
  }
}
