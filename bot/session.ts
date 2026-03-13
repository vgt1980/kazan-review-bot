import { session, SessionFlavor } from 'grammy';
import { SessionData, ReviewStep } from './types';

// Initial session data
function initialSession(): SessionData {
  return {
    reviewForm: {
      step: ReviewStep.IDLE,
      photos: [],
      photoType: 'place',
    },
    lastAction: Date.now(),
    languageCode: 'ru',
  };
}

// In-memory session storage (for development)
// In production, use database-backed storage
const sessionStore = new Map<string, SessionData>();

// Session middleware
export function getSessionKey(ctx: any): string | undefined {
  return ctx.from?.id.toString();
}

export const sessionMiddleware = session({
  initial: initialSession,
  getSessionKey,
  storage: {
    read: async (key: string) => {
      return sessionStore.get(key) || initialSession();
    },
    write: async (key: string, data: SessionData) => {
      sessionStore.set(key, data);
    },
    delete: async (key: string) => {
      sessionStore.delete(key);
    },
  },
});

// Clear session
export async function clearSession(ctx: any): Promise<void> {
  const key = getSessionKey(ctx);
  if (key) {
    sessionStore.delete(key);
  }
}

// Reset review form
export function resetReviewForm(): SessionData['reviewForm'] {
  return {
    step: ReviewStep.IDLE,
    photos: [],
    photoType: 'place',
  };
}
