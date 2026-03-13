// Input validation utilities

// Minimum text length for review
export const MIN_REVIEW_TEXT_LENGTH = 20;

// Maximum text length for review
export const MAX_REVIEW_TEXT_LENGTH = 2000;

// Maximum place name length
export const MAX_PLACE_NAME_LENGTH = 100;

// Maximum address length
export const MAX_ADDRESS_LENGTH = 200;

// Rate limit: max actions per time window
export const RATE_LIMITS = {
  REVIEW_PER_DAY: 10,
  VOTE_PER_HOUR: 50,
  COMPLAINT_PER_DAY: 10,
  MESSAGE_PER_MINUTE: 10,
};

// Validate rating (1-10)
export function validateRating(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 10;
}

// Validate review text
export function validateReviewText(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Текст отзыва не может быть пустым.' };
  }
  
  if (text.trim().length < MIN_REVIEW_TEXT_LENGTH) {
    return { valid: false, error: `Минимум ${MIN_REVIEW_TEXT_LENGTH} символов. Сейчас: ${text.trim().length}.` };
  }
  
  if (text.length > MAX_REVIEW_TEXT_LENGTH) {
    return { valid: false, error: `Максимум ${MAX_REVIEW_TEXT_LENGTH} символов.` };
  }
  
  // Check for spam patterns
  const spamPatterns = [
    /(.)\1{10,}/, // Repeated characters
    /(https?:\/\/|www\.)/i, // URLs
    /@[\w]+/g, // Mentions
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(text)) {
      return { valid: false, error: 'Текст содержит недопустимый контент.' };
    }
  }
  
  return { valid: true };
}

// Validate place name
export function validatePlaceName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Название не может быть пустым.' };
  }
  
  if (name.trim().length < 2) {
    return { valid: false, error: 'Название слишком короткое.' };
  }
  
  if (name.length > MAX_PLACE_NAME_LENGTH) {
    return { valid: false, error: `Максимум ${MAX_PLACE_NAME_LENGTH} символов.` };
  }
  
  return { valid: true };
}

// Validate address/district
export function validateAddress(address: string): { valid: boolean; error?: string } {
  if (!address || address.trim().length === 0) {
    return { valid: false, error: 'Адрес не может быть пустым.' };
  }
  
  if (address.length > MAX_ADDRESS_LENGTH) {
    return { valid: false, error: `Максимум ${MAX_ADDRESS_LENGTH} символов.` };
  }
  
  return { valid: true };
}

// Check if user is rate limited
export function isRateLimited(
  count: number,
  limit: number,
  windowStart: Date,
  windowMinutes: number
): boolean {
  const now = new Date();
  const windowEnd = new Date(windowStart.getTime() + windowMinutes * 60 * 1000);
  
  if (now > windowEnd) {
    return false; // Window expired
  }
  
  return count >= limit;
}

// Sanitize user input
export function sanitizeInput(text: string): string {
  return text
    .trim()
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .substring(0, MAX_REVIEW_TEXT_LENGTH);
}

// Extract mention from text
export function extractMention(text: string): string | null {
  const match = text.match(/@(\w+)/);
  return match ? match[1] : null;
}

// Validate Telegram file ID format
export function isValidFileId(fileId: string): boolean {
  return fileId.length > 10 && fileId.length < 200;
}

// Check if text contains profanity (basic check)
const PROFANITY_WORDS = [
  // Add Russian profanity words here for production
  // This is a placeholder list
];

export function containsProfanity(text: string): boolean {
  const lowerText = text.toLowerCase();
  return PROFANITY_WORDS.some(word => lowerText.includes(word));
}

// Get user status based on review count
export function getUserStatus(reviewCount: number): string {
  if (reviewCount >= 50) return 'TOP_REVIEWER';
  if (reviewCount >= 20) return 'EXPERT';
  if (reviewCount >= 5) return 'ACTIVE';
  return 'NOVICE';
}
