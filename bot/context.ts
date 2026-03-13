import { Context, SessionFlavor } from 'grammy';
import { SessionData } from './types';

// Custom context with session support
export type BotContext = Context & SessionFlavor<SessionData>;

// Admin context middleware type
export interface AdminContext extends BotContext {
  isAdmin: boolean;
  adminRole?: 'ADMIN' | 'SUPER_ADMIN';
}

// Helper to check if user is admin
export async function checkAdmin(userId: string, prisma: any): Promise<{ isAdmin: boolean; role?: string }> {
  const admin = await prisma.adminUser.findFirst({
    where: { userId },
    include: { user: true },
  });
  
  if (admin) {
    return { isAdmin: true, role: admin.role };
  }
  
  // Also check environment variable for super admins
  const superAdminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim());
  if (superAdminIds.includes(userId)) {
    return { isAdmin: true, role: 'SUPER_ADMIN' };
  }
  
  return { isAdmin: false };
}

// Helper to get Telegram user info
export function getTelegramUser(ctx: BotContext) {
  return {
    id: ctx.from?.id,
    username: ctx.from?.username,
    firstName: ctx.from?.first_name,
    lastName: ctx.from?.last_name,
    languageCode: ctx.from?.language_code,
  };
}
