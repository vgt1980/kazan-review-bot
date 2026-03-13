import { BotContext } from '../context';
import { getComplaintReasonKeyboard, getReviewVoteKeyboard } from '../keyboards/main';
import { ComplaintReason } from '@prisma/client';
import prisma from '../../src/lib/db';

// Handle vote on review
export async function handleVote(
  ctx: BotContext, 
  reviewId: string, 
  voteType: 'up' | 'down'
): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  
  if (!telegramId) {
    await ctx.answerCallbackQuery('Ошибка: пользователь не определён');
    return;
  }
  
  // Get or create user
  let user = await prisma.user.findUnique({
    where: { telegramId },
  });
  
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
      },
    });
  }
  
  // Check if already voted
  const existingVote = await prisma.reviewVote.findUnique({
    where: {
      reviewId_userId: { reviewId, userId: user.id },
    },
  });
  
  if (existingVote) {
    // If same vote type, remove it
    if (existingVote.voteType === voteType) {
      await prisma.reviewVote.delete({
        where: { id: existingVote.id },
      });
      
      // Update review counters
      if (voteType === 'up') {
        await prisma.review.update({
          where: { id: reviewId },
          data: { upvotes: { decrement: 1 } },
        });
      } else {
        await prisma.review.update({
          where: { id: reviewId },
          data: { downvotes: { decrement: 1 } },
        });
      }
      
      await ctx.answerCallbackQuery('Ваш голос удалён');
    } else {
      // Change vote type
      await prisma.reviewVote.update({
        where: { id: existingVote.id },
        data: { voteType },
      });
      
      // Update counters
      if (voteType === 'up') {
        await prisma.review.update({
          where: { id: reviewId },
          data: {
            upvotes: { increment: 1 },
            downvotes: { decrement: 1 },
          },
        });
      } else {
        await prisma.review.update({
          where: { id: reviewId },
          data: {
            upvotes: { decrement: 1 },
            downvotes: { increment: 1 },
          },
        });
      }
      
      await ctx.answerCallbackQuery('Ваш голос изменён');
    }
  } else {
    // Create new vote
    await prisma.reviewVote.create({
      data: {
        reviewId,
        userId: user.id,
        voteType,
      },
    });
    
    // Update counters
    if (voteType === 'up') {
      await prisma.review.update({
        where: { id: reviewId },
        data: {
          upvotes: { increment: 1 },
        },
      });
      
      // Update user helpful votes
      const review = await prisma.review.findUnique({
        where: { id: reviewId },
        select: { userId: true },
      });
      
      if (review) {
        await prisma.user.update({
          where: { id: review.userId },
          data: { helpfulVotes: { increment: 1 } },
        });
      }
    } else {
      await prisma.review.update({
        where: { id: reviewId },
        data: { downvotes: { increment: 1 } },
      });
    }
    
    await ctx.answerCallbackQuery('Спасибо за ваш голос!');
  }
  
  // Get updated review and update keyboard
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });
  
  if (review) {
    try {
      await ctx.editMessageReplyMarkup({
        reply_markup: getReviewVoteKeyboard(reviewId, review.upvotes, review.downvotes),
      });
    } catch (e) {
      // Message might not have changed
    }
  }
}

// Start complaint flow
export async function startComplaint(ctx: BotContext, reviewId: string): Promise<void> {
  await ctx.reply(
    '🚩 <b>Пожаловаться на отзыв</b>\n\n' +
    'Выберите причину жалобы:',
    {
      parse_mode: 'HTML',
      reply_markup: getComplaintReasonKeyboard(reviewId),
    }
  );
}

// Submit complaint
export async function submitComplaint(
  ctx: BotContext,
  reviewId: string,
  reason: ComplaintReason
): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  
  if (!telegramId) {
    await ctx.reply('Ошибка: пользователь не определён');
    return;
  }
  
  const user = await prisma.user.findUnique({
    where: { telegramId },
  });
  
  if (!user) {
    await ctx.reply('Сначала отправьте /start для регистрации.');
    return;
  }
  
  // Check if already complained
  const existing = await prisma.complaint.findFirst({
    where: { reviewId, userId: user.id },
  });
  
  if (existing) {
    await ctx.reply('Вы уже жаловались на этот отзыв.', {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }
  
  // Create complaint
  await prisma.complaint.create({
    data: {
      reviewId,
      userId: user.id,
      reason,
      status: 'PENDING',
    },
  });
  
  await ctx.reply(
    '✅ Жалоба отправлена на рассмотрение модераторам.',
    { reply_markup: { remove_keyboard: true } }
  );
  
  // Notify admins
  const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim());
  
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { place: true, user: true },
  });
  
  if (review) {
    const complaintReasonNames: Record<string, string> = {
      FALSE_INFO: '❌ Ложная информация',
      INSULTS: '🤬 Оскорбления',
      ADVERTISING: '📢 Реклама',
      OTHER: '📝 Другое',
    };
    
    const message = `🚩 <b>Новая жалоба</b>\n\n` +
      `📍 Заведение: ${review.place.name}\n` +
      `👤 Автор отзыва: ${review.user.username ? '@' + review.user.username : 'ID: ' + review.user.telegramId}\n` +
      `📋 Причина: ${complaintReasonNames[reason]}\n` +
      `💬 Текст: ${review.text.substring(0, 200)}...`;
    
    for (const adminId of adminIds) {
      try {
        await ctx.api.sendMessage(adminId, message, { parse_mode: 'HTML' });
      } catch (e) {
        console.error('Failed to notify admin:', e);
      }
    }
  }
}

// Cancel complaint
export async function cancelComplaint(ctx: BotContext): Promise<void> {
  await ctx.reply('Жалоба отменена.', {
    reply_markup: { remove_keyboard: true },
  });
}
