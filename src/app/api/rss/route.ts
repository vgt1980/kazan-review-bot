import { NextRequest, NextResponse } from 'next/server';
import {
  parseRSSFeed,
  fetchKazanPlaceNews,
  generatePostFromRSSItem,
  RSS_SOURCES,
  RSSItem,
  getRSSSources,
  getNewsSourcesToScrape,
} from '@/lib/rss/parser';
import {
  scrapeAllSources,
  fetchArticleContent,
  getScrapeSources,
} from '@/lib/rss/kazan-news-scraper';
import { sendPhotoToChannel, sendMessageToChannel } from '@/lib/auto-poster/telegram-poster';
import ZAI from 'z-ai-web-dev-sdk';

const CHANNEL_ID = (process.env.CHANNEL_ID || '-1003809470742').trim();
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = ['1892592914'];

/**
 * GET - Fetch RSS news about Kazan places
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxItems = parseInt(searchParams.get('max') || '15');
    const source = searchParams.get('source');
    const includeScraped = searchParams.get('scrape') === 'true';

    // If specific source requested
    if (source) {
      const feed = await parseRSSFeed(source);
      if (!feed) {
        return NextResponse.json({ error: 'Failed to fetch RSS feed' }, { status: 500 });
      }
      return NextResponse.json({ source: feed.title, items: feed.items.slice(0, maxItems) });
    }

    // Fetch from RSS sources
    const rssItems = await fetchKazanPlaceNews(maxItems);

    // Optionally include scraped news
    let scrapedItems: any[] = [];
    if (includeScraped) {
      scrapedItems = await scrapeAllSources(10);
    }

    // Combine and sort by date
    const allItems = [...rssItems, ...scrapedItems]
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, maxItems);

    return NextResponse.json({
      success: true,
      count: allItems.length,
      sources: {
        rss: RSS_SOURCES.map(s => s.name),
        scraped: getScrapeSources().map(s => s.name),
      },
      items: allItems,
    });
  } catch (error) {
    console.error('RSS API error:', error);
    return NextResponse.json({ error: 'Failed to process RSS request' }, { status: 500 });
  }
}

/**
 * POST - Various RSS operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, item, generateImage, telegramId, url } = body;

    // Verify admin for write operations
    const envAdminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim()).filter(id => id);
    const allAdminIds = [...new Set([...ADMIN_IDS, ...envAdminIds])];
    
    if (!telegramId || !allAdminIds.includes(String(telegramId).trim())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch news from all sources
    if (action === 'fetch') {
      const rssItems = await fetchKazanPlaceNews(20);
      const scrapedItems = await scrapeAllSources(10);
      
      const allItems = [...rssItems, ...scrapedItems]
        .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

      return NextResponse.json({ 
        success: true, 
        count: allItems.length, 
        items: allItems 
      });
    }

    // Scrape news from web sources
    if (action === 'scrape') {
      const items = await scrapeAllSources(20);
      return NextResponse.json({
        success: true,
        count: items.length,
        items,
        sources: getScrapeSources().map(s => s.name),
      });
    }

    // Fetch full article content
    if (action === 'fetch_article' && url) {
      const article = await fetchArticleContent(url);
      if (!article) {
        return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
      }
      return NextResponse.json({ success: true, article });
    }

    // Get available sources
    if (action === 'sources') {
      return NextResponse.json({
        rss: getRSSSources(),
        scraped: getNewsSourcesToScrape(),
      });
    }

    // Publish item to Telegram channel
    if (action === 'publish' && item) {
      const rssItem: RSSItem = item;
      const caption = generatePostFromRSSItem(rssItem);

      let success = false;

      // Generate image if requested
      let imageBase64 = null;
      
      if (generateImage) {
        try {
          const zai = await ZAI.create();
          const prompt = `News illustration: ${rssItem.title}. Professional journalism style, modern design, Kazan city theme`;
          const response = await zai.images.generations.create({
            prompt,
            size: '1344x768',
          });
          if (response.data?.[0]?.base64) {
            imageBase64 = response.data[0].base64;
          }
        } catch (imgError) {
          console.error('Image generation failed:', imgError);
        }
      }

      // Try to use existing image
      if (imageBase64) {
        success = await sendPhotoToChannel(imageBase64, caption);
      } else if (rssItem.imageUrl) {
        try {
          const imgResponse = await fetch(rssItem.imageUrl);
          if (imgResponse.ok) {
            const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
            imageBase64 = imgBuffer.toString('base64');
            success = await sendPhotoToChannel(imageBase64, caption);
          }
        } catch (e) {
          console.error('Failed to fetch RSS image:', e);
        }
      }

      if (!success) {
        success = await sendMessageToChannel(caption);
      }

      return NextResponse.json({
        success,
        message: success ? 'Пост опубликован в канал!' : 'Ошибка при публикации',
      });
    }

    // Publish latest news automatically
    if (action === 'publish_latest') {
      const items = await fetchKazanPlaceNews(5);

      if (items.length === 0) {
        return NextResponse.json({ success: false, message: 'Нет новостей для публикации' });
      }

      const topItem = items[0];
      const caption = generatePostFromRSSItem(topItem);

      let imageBase64 = null;
      if (topItem.imageUrl) {
        try {
          const imgResponse = await fetch(topItem.imageUrl);
          if (imgResponse.ok) {
            const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
            imageBase64 = imgBuffer.toString('base64');
          }
        } catch (e) {
          console.error('Failed to fetch image:', e);
        }
      }

      let success = false;
      if (imageBase64) {
        success = await sendPhotoToChannel(imageBase64, caption);
      }
      
      if (!success) {
        success = await sendMessageToChannel(caption);
      }

      return NextResponse.json({
        success,
        message: success ? `Опубликовано: "${topItem.title}"` : 'Ошибка при публикации',
        item: topItem,
      });
    }

    return NextResponse.json({ 
      error: 'Invalid action. Use: fetch, scrape, fetch_article, sources, publish, publish_latest' 
    }, { status: 400 });
  } catch (error) {
    console.error('RSS POST error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
