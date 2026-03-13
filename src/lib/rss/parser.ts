/**
 * RSS Parser for Kazan places and establishments news
 * Fetches and filters news about restaurants, cafes, hotels, and places in Kazan
 */

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  imageUrl?: string;
  category?: string;
}

export interface RSSFeed {
  title: string;
  link: string;
  items: RSSItem[];
}

// RSS sources for Kazan and Tatarstan places/establishments
// Focused on restaurant, cafe, beauty, entertainment news
export const RSS_SOURCES = [
  // Tatarstan & Kazan focused news
  {
    name: 'Tatar-Inform',
    url: 'https://www.tatar-inform.ru/rss',
    category: 'regional',
    priority: 1,
  },
  {
    name: 'Бизнес-Онлайн (Татарстан)',
    url: 'https://www.business-gazeta.ru/rss.xml',
    category: 'business',
    priority: 1,
  },
  {
    name: 'Казанские ведомости',
    url: 'https://kvnews.ru/rss.xml',
    category: 'regional',
    priority: 1,
  },
  {
    name: 'Реальное время',
    url: 'https://realnoevremya.ru/rss',
    category: 'regional',
    priority: 1,
  },
  // General Russian news that often covers Kazan establishments
  {
    name: 'Lenta.ru',
    url: 'https://lenta.ru/rss',
    category: 'general',
    priority: 2,
  },
  {
    name: 'РБК',
    url: 'https://rssexport.rbc.ru/rbcnews/news/20/full.rss',
    category: 'business',
    priority: 2,
  },
];

// News sites to scrape (they don't have RSS but have great content)
export const NEWS_SOURCES_TO_SCRAPE = [
  {
    name: 'Афиша Казань - Рестораны',
    url: 'https://www.afisha.ru/kazan/restaurant-news/',
    type: 'scrape',
    category: 'restaurants',
  },
  {
    name: 'Собака.ру Казань',
    url: 'https://m.sobaka.ru/kzn/bars/opening',
    type: 'scrape',
    category: 'openings',
  },
  {
    name: 'Restoclub Казань',
    url: 'https://www.restoclub.ru/kzn/community',
    type: 'scrape',
    category: 'reviews',
  },
  {
    name: 'ИНДЕ Казань - Новые заведения',
    url: 'https://inde.io/article/gde-est-i-pit-v-kazani-12-novyh-restoranov-i-kafe-fevralya-i-vesny',
    type: 'scrape',
    category: 'new_places',
  },
  {
    name: 'РБК Татарстан - Гастрономия',
    url: 'https://rt.rbc.ru/tatarstan',
    type: 'scrape',
    category: 'business',
  },
  {
    name: 'OVVY Казань',
    url: 'https://ovvy.ru/kazan',
    type: 'scrape',
    category: 'places',
  },
  {
    name: 'Yandex Еда - Новые места Казани',
    url: 'https://eda.yandex.ru/guide-places-selection/novye_restorany_i_kafe_kazan',
    type: 'scrape',
    category: 'new_places',
  },
];

// Keywords related to places, establishments, food, entertainment
const PLACE_KEYWORDS = [
  // Food & Dining
  'ресторан', 'кафе', 'бар', 'кофейня', 'пиццерия', 'суши', 'бургер',
  'стейк', 'гастроном', 'заведение', 'питание', 'еда', 'кухня', 'меню',
  'шеф-повар', 'бистро', 'трактир', 'столовая', 'фастфуд', 'гастропаб',
  'паб', 'винотека', 'чайхана', 'пекарня', 'кондитерская',
  
  // Hotels & Accommodation
  'отель', 'гостиница', 'хостел', 'апартамент', 'номер', 'холидей',
  
  // Entertainment
  'клуб', 'кинотеатр', 'театр', 'музей', 'выставка', 'концерт',
  'развлечение', 'досуг', 'аквапарк', 'парк', 'квест', 'боулинг',
  
  // Beauty & Health
  'салон красоты', 'спа', 'барбершоп', 'парикмахерская', 'массаж',
  'фитнес', 'спортзал', 'бассейн', 'ногтевая студия', 'косметолог',
  'визажист', 'солярий', 'зоосалон', 'груминг', 'зооклиника', 'ветклиника',
  
  // Shopping
  'торговый центр', 'тц ', 'магазин', 'супермаркет', 'молл',
  'аутлет', 'маркетплейс', 'шоурум', 'бутик',
  
  // Services
  'сервис', 'услуга', 'ремонт', 'автосервис', 'автомойка', 'химчистка',
  'прачечная', 'ателье',
  
  // Actions
  'открыл', 'открытие', 'открылась', 'открылся', 'запуск',
  'новый', 'новая', 'новое', 'обновлен', 'рейтинг', 'лучший',
  'обзор', 'рецензия', 'отзыв', 'где поесть', 'куда сходить',
  
  // Location
  'казан', 'казань', 'татарстан',
];

// Keywords to exclude (politics, war, crimes)
const EXCLUDE_KEYWORDS = [
  'война', 'сво', 'украин', 'ракет', 'обстрел', 'взрыв',
  'убийств', 'преступлен', 'суд ', 'приговор',
  'политик', 'депутат', 'выборы', 'парти', 'митинг',
  'коррупци', 'скандал', 'расследован',
];

/**
 * Parse RSS feed from URL
 */
export async function parseRSSFeed(url: string): Promise<RSSFeed | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KazanPlacesBot/1.0)',
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

  const channelTitleMatch = xml.match(/<channel>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
  const channelLinkMatch = xml.match(/<channel>[\s\S]*?<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/);

  const feedTitle = channelTitleMatch?.[1]?.trim() || 'RSS Feed';
  const feedLink = channelLinkMatch?.[1]?.trim() || '';

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
    const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/);
    const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    
    // Try different image formats
    let imageUrl = '';
    const imageMatch = itemXml.match(/<enclosure[^>]*url="(.*?)"/) ||
                       itemXml.match(/<media:content[^>]*url="(.*?)"/) ||
                       itemXml.match(/<media:thumbnail[^>]*url="(.*?)"/) ||
                       itemXml.match(/<content:encoded[^>]*]*><img[^>]*src="(.*?)"/);
    
    if (imageMatch) {
      imageUrl = imageMatch[1];
    }
    
    const categoryMatch = itemXml.match(/<category>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/category>/);

    if (titleMatch && linkMatch) {
      items.push({
        title: decodeHTMLEntities(titleMatch[1].trim()),
        link: linkMatch[1].trim(),
        description: descMatch ? decodeHTMLEntities(descMatch[1].trim()) : '',
        pubDate: dateMatch?.[1] || new Date().toISOString(),
        source: feedTitle,
        imageUrl,
        category: categoryMatch?.[1]?.trim(),
      });
    }
  }

  return { title: feedTitle, link: feedLink, items };
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
    '&#39;': "'",
    '&#34;': '"',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  decoded = decoded.replace(/<!\[CDATA\[|\]\]>/g, '');
  decoded = decoded.replace(/<[^>]*>/g, ''); // Remove HTML tags

  return decoded.trim();
}

/**
 * Check if item is related to places/establishments in Kazan
 */
export function isPlaceRelated(item: RSSItem): boolean {
  const textToCheck = `${item.title} ${item.description}`.toLowerCase();

  // Check for exclusion keywords first
  const hasExcluded = EXCLUDE_KEYWORDS.some(keyword =>
    textToCheck.includes(keyword.toLowerCase())
  );
  
  if (hasExcluded) return false;

  // Check for place keywords
  const hasPlaceKeyword = PLACE_KEYWORDS.some(keyword =>
    textToCheck.includes(keyword.toLowerCase())
  );

  // Prefer items with Kazan/Tatarstan
  const hasKazan = textToCheck.includes('казан') || textToCheck.includes('казань') || textToCheck.includes('татарстан');

  return hasPlaceKeyword || hasKazan;
}

/**
 * Fetch all RSS items (raw)
 */
export async function fetchAllRSSItems(maxPerSource: number = 20): Promise<RSSItem[]> {
  const allItems: RSSItem[] = [];

  for (const source of RSS_SOURCES) {
    try {
      const feed = await parseRSSFeed(source.url);

      if (feed) {
        allItems.push(...feed.items.slice(0, maxPerSource));
      }
    } catch (error) {
      console.error(`Error fetching from ${source.name}:`, error);
    }
  }

  return allItems;
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
        const filteredItems = feed.items.filter(isPlaceRelated);
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
  const maxLen = 950; // Telegram caption limit with reserve

  let post = `<b>📰 ${escapeHtml(item.title)}</b>\n\n`;

  if (item.description) {
    let desc = item.description.trim();

    if (desc.length > 350) {
      desc = desc.substring(0, 350) + '...';
    }

    post += `${escapeHtml(desc)}\n\n`;
  }

  post += `🔗 <a href="${item.link}">Читать полностью</a>\n`;
  post += `📢 ${item.source}\n\n`;
  post += `🤖 @Chest_Kazan_bot`;

  // Add relevant hashtags
  const text = `${item.title} ${item.description}`.toLowerCase();
  const tags: string[] = ['#Казань', '#Новости'];
  
  if (text.includes('ресторан') || text.includes('кафе')) tags.push('#Рестораны');
  if (text.includes('отель') || text.includes('гостиниц')) tags.push('#Отели');
  if (text.includes('открыл') || text.includes('открытие')) tags.push('#Открытие');
  if (text.includes('бар') || text.includes('паб')) tags.push('#Бары');
  if (text.includes('салон') || text.includes('красоты')) tags.push('#Красота');
  
  post += '\n' + tags.join(' ');

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

/**
 * Get list of available RSS sources
 */
export function getRSSSources() {
  return RSS_SOURCES.map(s => ({
    name: s.name,
    url: s.url,
    category: s.category,
    priority: s.priority,
  }));
}

/**
 * Get list of news sources to scrape
 */
export function getNewsSourcesToScrape() {
  return NEWS_SOURCES_TO_SCRAPE;
}
