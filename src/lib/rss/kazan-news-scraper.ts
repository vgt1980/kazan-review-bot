/**
 * Web scraper for Kazan establishment news
 * Scrapes news from various sources about restaurants, cafes, beauty salons, etc.
 */

import ZAI from 'z-ai-web-dev-sdk';

export interface ScrapedNewsItem {
  title: string;
  link: string;
  description: string;
  imageUrl?: string;
  source: string;
  pubDate: string;
  category?: string;
}

// News sources to scrape
const SCRAPE_SOURCES = [
  {
    name: 'Афиша Казань - Новости ресторанов',
    url: 'https://www.afisha.ru/kazan/restaurant-news/',
    category: 'restaurants',
    priority: 1,
  },
  {
    name: 'Собака.ру Казань - Открытия',
    url: 'https://m.sobaka.ru/kzn/bars/opening',
    category: 'openings',
    priority: 1,
  },
  {
    name: 'РБК Татарстан',
    url: 'https://rt.rbc.ru/tatarstan',
    category: 'business',
    priority: 2,
  },
];

// Keywords to filter relevant content
const RELEVANT_KEYWORDS = [
  'ресторан', 'кафе', 'бар', 'кофейня', 'пиццерия',
  'отель', 'гостиница', 'салон', 'красоты', 'барбершоп',
  'зооклиника', 'ветклиника', 'фитнес', 'спортзал',
  'открытие', 'открылся', 'новый', 'заведение',
  'казан', 'казань', 'татарстан',
  'меню', 'кухня', 'гастро', 'шеф',
  'рейтинг', 'лучший', 'обзор', 'отзыв',
];

const EXCLUDE_KEYWORDS = [
  'война', 'сво', 'политик', 'выборы', 'депутат',
  'преступлен', 'убийств', 'суд ', 'приговор',
];

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/**
 * Extract news items from HTML content
 */
function extractNewsFromHTML(html: string, sourceUrl: string, sourceName: string): ScrapedNewsItem[] {
  const items: ScrapedNewsItem[] = [];
  
  // Generic patterns to find article links and titles
  const articlePatterns = [
    // Article with link pattern
    /<a[^>]*href=["']([^"']*(?:article|news|rest|place|open)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    // News item pattern
    /<div[^>]*class=["'][^"']*(?:news|article|item|card)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    // Link with title
    /<h[23][^>]*><a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a><\/h[23]>/gi,
  ];

  // Extract links with titles
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const link = match[1];
    const title = match[2].trim();
    
    // Skip if title is too short or looks like navigation
    if (title.length < 10 || 
        /^(вход|регистраци|главная|контакты|о нас|все|больш|ещё|подроб)/i.test(title)) {
      continue;
    }
    
    // Make absolute URL
    const fullUrl = link.startsWith('http') ? link : new URL(link, sourceUrl).href;
    
    items.push({
      title: title,
      link: fullUrl,
      description: '',
      source: sourceName,
      pubDate: new Date().toISOString(),
      category: 'scraped',
    });
  }

  // Extract images
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']+)["']/gi;
  const images: { url: string; alt: string }[] = [];
  while ((match = imgRegex.exec(html)) !== null) {
    images.push({ url: match[1], alt: match[2] });
  }

  // Match images to items by title similarity
  for (const item of items) {
    const matchingImg = images.find(img => 
      item.title.toLowerCase().includes(img.alt.toLowerCase()) ||
      img.alt.toLowerCase().includes(item.title.toLowerCase().slice(0, 20))
    );
    if (matchingImg) {
      item.imageUrl = matchingImg.url.startsWith('http') 
        ? matchingImg.url 
        : new URL(matchingImg.url, sourceUrl).href;
    }
  }

  return items;
}

/**
 * Check if item is relevant to Kazan establishments
 */
function isRelevantItem(item: ScrapedNewsItem): boolean {
  const text = `${item.title} ${item.description}`.toLowerCase();
  
  // Check exclusion keywords
  if (EXCLUDE_KEYWORDS.some(kw => text.includes(kw))) {
    return false;
  }
  
  // Check relevant keywords
  return RELEVANT_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * Scrape a single source
 */
export async function scrapeSource(
  source: typeof SCRAPE_SOURCES[0]
): Promise<ScrapedNewsItem[]> {
  try {
    const zai = await getZAI();
    
    console.log(`Scraping ${source.name}...`);
    
    const result = await zai.functions.invoke('page_reader', {
      url: source.url,
    });

    if (!result?.data?.html) {
      console.error(`No content from ${source.name}`);
      return [];
    }

    const items = extractNewsFromHTML(
      result.data.html,
      source.url,
      source.name
    );

    // Filter relevant items
    const relevantItems = items.filter(isRelevantItem);
    
    console.log(`Found ${relevantItems.length} relevant items from ${source.name}`);
    
    return relevantItems;
  } catch (error) {
    console.error(`Error scraping ${source.name}:`, error);
    return [];
  }
}

/**
 * Scrape all sources
 */
export async function scrapeAllSources(maxItems: number = 20): Promise<ScrapedNewsItem[]> {
  const allItems: ScrapedNewsItem[] = [];

  for (const source of SCRAPE_SOURCES) {
    const items = await scrapeSource(source);
    allItems.push(...items);
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Deduplicate by link
  const seen = new Set<string>();
  const uniqueItems = allItems.filter(item => {
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });

  return uniqueItems.slice(0, maxItems);
}

/**
 * Fetch full article content
 */
export async function fetchArticleContent(url: string): Promise<{
  title: string;
  content: string;
  imageUrl?: string;
} | null> {
  try {
    const zai = await getZAI();
    
    const result = await zai.functions.invoke('page_reader', {
      url: url,
    });

    if (!result?.data?.html) {
      return null;
    }

    // Extract plain text from HTML
    const content = result.data.html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract first image
    const imgMatch = result.data.html.match(/<img[^>]*src=["']([^"']+)["']/i);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    return {
      title: result.data.title || '',
      content: content.slice(0, 2000), // Limit content length
      imageUrl: imageUrl?.startsWith('http') ? imageUrl : undefined,
    };
  } catch (error) {
    console.error(`Error fetching article ${url}:`, error);
    return null;
  }
}

/**
 * Get available scrape sources
 */
export function getScrapeSources() {
  return SCRAPE_SOURCES;
}
