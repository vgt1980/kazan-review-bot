/**
 * RSS Parser for Kazan news and places
 * Fetches and filters news about restaurants, cafes, and places in Kazan
 */

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  imageUrl?: string;
}

export interface RSSFeed {
  title: string;
  link: string;
  items: RSSItem[];
}

// RSS sources for Kazan and Tatarstan news
export const RSS_SOURCES = [
  {
    name: 'Lenta.ru',
    url: 'https://lenta.ru/rss',
    filter: ['казан', 'казань', 'татарстан', 'кафе', 'ресторан'],
  },
  {
    name: 'Tatar-Inform',
    url: 'https://www.tatar-inform.ru/rss',
    filter: ['кафе', 'ресторан', 'заведени', 'гастроном', 'пищ', 'еда'],
  },
];

// Keywords related to places and food
const PLACE_KEYWORDS = [
  'ресторан',
  'кафе',
  'бар',
  'кофейня',
  'пиццерия',
  'суши',
  'бургер',
  'стейк',
  'гастроном',
  'заведение',
  'питание',
  'еда',
  'кухня',
  'меню',
  'шеф-повар',
  'открыл',
  'открытие',
  'закрыл',
  'закрытие',
  'казан',
  'казань',
];

/**
 * Parse RSS feed from URL
 */
export async function parseRSSFeed(url: string): Promise<RSSFeed | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KazanReviewBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      console.error(`RSS fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const text = await response.text();
    return parseRSSContent(text);
  } catch (error) {
    console.error('Error parsing RSS feed:', error);
    return null;
  }
}

/**
 * Parse RSS XML content
 */
function parseRSSContent(xml: string): RSSFeed {
  const items: RSSItem[] = [];

  // Extract channel info
  const channelTitleMatch = xml.match(/<channel>[\s\S]*?<title>(.*?)<\/title>/);
  const channelLinkMatch = xml.match(/<channel>[\s\S]*?<link>(.*?)<\/link>/);

  const feedTitle = channelTitleMatch?.[1]?.trim() || 'RSS Feed';
  const feedLink = channelLinkMatch?.[1]?.trim() || '';

  // Extract items - use RegExp exec instead of matchAll for compatibility
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
    const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/);
    const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    const imageMatch = itemXml.match(/<enclosure[^>]*url="(.*?)"/);

    if (titleMatch && linkMatch) {
      items.push({
        title: decodeHTMLEntities(titleMatch[1].trim()),
        link: linkMatch[1].trim(),
        description: descMatch ? decodeHTMLEntities(descMatch[1].trim()) : '',
        pubDate: dateMatch?.[1] || new Date().toISOString(),
        source: feedTitle,
        imageUrl: imageMatch?.[1],
      });
    }
  }

  return {
    title: feedTitle,
    link: feedLink,
    items,
  };
}

/**
 * Decode HTML entities
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  // Remove CDATA markers if any
  decoded = decoded.replace(/<!\[CDATA\[|\]\]>/g, '');

  return decoded.trim();
}

/**
 * Check if item is related to places/food in Kazan
 */
export function isPlaceRelated(item: RSSItem): boolean {
  const textToCheck = `${item.title} ${item.description}`.toLowerCase();

  // Check for Kazan keyword first
  const hasKazan = textToCheck.includes('казан') || textToCheck.includes('казань');

  // Check for place keywords
  const hasPlaceKeyword = PLACE_KEYWORDS.some(keyword =>
    textToCheck.includes(keyword.toLowerCase())
  );

  return hasKazan || hasPlaceKeyword;
}

/**
 * Fetch and filter news about Kazan places
 */
export async function fetchKazanPlaceNews(maxItems: number = 10): Promise<RSSItem[]> {
  const allItems: RSSItem[] = [];

  for (const source of RSS_SOURCES) {
    try {
      const feed = await parseRSSFeed(source.url);

      if (feed) {
        const filteredItems = feed.items
          .filter(isPlaceRelated)
          .slice(0, maxItems);

        allItems.push(...filteredItems);
      }
    } catch (error) {
      console.error(`Error fetching from ${source.name}:`, error);
    }
  }

  // Sort by date (newest first) and deduplicate
  const seen = new Set<string>();
  const uniqueItems = allItems
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .filter(item => {
      const key = item.link;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return uniqueItems.slice(0, maxItems);
}

/**
 * Generate Telegram post from RSS item
 */
export function generatePostFromRSSItem(item: RSSItem): string {
  const maxLen = 900; // Telegram caption limit with reserve

  let post = `<b>📰 ${escapeHtml(item.title)}</b>\n\n`;

  if (item.description) {
    // Clean description
    let desc = item.description
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .trim();

    // Truncate if too long
    if (desc.length > 400) {
      desc = desc.substring(0, 400) + '...';
    }

    post += `${escapeHtml(desc)}\n\n`;
  }

  post += `🔗 <a href="${item.link}">Читать далее</a>\n`;
  post += `📢 ${item.source}\n\n`;
  post += `🤖 @Chest_Kazan_bot\n`;
  post += `#Казань #Новости`;

  // Ensure not too long
  if (post.length > maxLen) {
    post = post.substring(0, maxLen - 50) + '...\n\n🤖 @Chest_Kazan_bot';
  }

  return post;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
