import { MiddlewareFn } from "grammy";
import { BotContext } from "../context";
import { getUser } from "../utils/db";
import { User } from "@prisma/client";

// User middleware - ensures user exists in database
export const userMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  if (!ctx.from) {
    return next();
  }

  const telegramId = ctx.from.id.toString();

  try {
    // Check if user exists
    let user = await getUser(telegramId);

    if (!user) {
      // Create new user
      const { createUser } = await import("../utils/db");
      user = await createUser({
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      await ctx.reply(
        "🚫 Ваш аккаунт заблокирован.\n\n" +
        (user.blockReason ? `Причина: ${user.blockReason}` : "")
      );
      return;
    }

    // Store user in context
    ctx.user = user;
  } catch (error) {
    console.error("Error in user middleware:", error);
  }

  return next();
};

// Extend context with user
declare module "grammy" {
  interface Context {
    user?: User;
  }
}
