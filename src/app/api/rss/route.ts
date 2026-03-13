import { NextRequest, NextResponse } from 'next/server';
import {
  parseRSSFeed,
  fetchKazanPlaceNews,
  generatePostFromRSSItem,
  RSS_SOURCES,
  RSSItem,
} from '@/lib/rss/parser';
import { sendPhotoToChannel, sendMessageToChannel } from '@/lib/auto-poster/telegram-poster';
import ZAI from 'z-ai-web-dev-sdk';

const CHANNEL_ID = (process.env.CHANNEL_ID || '-1003809470742').trim();
const BOT_TOKEN = process.env.BOT_TOKEN;

/**
 * GET - Fetch RSS news about Kazan places
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxItems = parseInt(searchParams.get('max') || '10');
    const source = searchParams.get('source');

    // Fetch from specific source or all
    if (source) {
      const feed = await parseRSSFeed(source);
      if (!feed) {
        return NextResponse.json(
          { error: 'Failed to fetch RSS feed' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        source: feed.title,
        items: feed.items.slice(0, maxItems),
      });
    }

    // Fetch filtered news about places
    const items = await fetchKazanPlaceNews(maxItems);

    return NextResponse.json({
      success: true,
      count: items.length,
      sources: RSS_SOURCES.map(s => s.name),
      items,
    });
  } catch (error) {
    console.error('RSS API error:', error);
    return NextResponse.json(
      { error: 'Failed to process RSS request' },
      { status: 500 }
    );
  }
}

/**
 * POST - Publish RSS item to Telegram channel
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, item, generateImage, telegramId } = body;

    // Verify admin
    const adminIds = (process.env.ADMIN_IDS || '').split(',');

    if (!telegramId || !adminIds.includes(telegramId.toString())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action === 'fetch') {
      // Just fetch and return filtered news
      const items = await fetchKazanPlaceNews(20);
      return NextResponse.json({
        success: true,
        count: items.length,
        items,
      });
    }

    if (action === 'publish' && item) {
      // Publish specific item
      const rssItem: RSSItem = item;
      const caption = generatePostFromRSSItem(rssItem);

      let success = false;

      // Generate image if requested
      if (generateImage) {
        const zai = await ZAI.create();

        const prompt = `News illustration about ${rssItem.title}. Modern, professional, news style, Kazan city theme`;

        try {
          const response = await zai.images.generations.create({
            prompt,
            size: '1344x768',
          });

          if (response.data?.[0]?.base64) {
            success = await sendPhotoToChannel(response.data[0].base64, caption);
          }
        } catch (imgError) {
          console.error('Image generation failed:', imgError);
        }
      }

      // Fallback to text message
      if (!success) {
        success = await sendMessageToChannel(caption);
      }

      return NextResponse.json({
        success,
        message: success
          ? 'Пост опубликован в канал!'
          : 'Ошибка при публикации',
      });
    }

    if (action === 'auto_publish') {
      // Auto-publish top news item
      const items = await fetchKazanPlaceNews(5);

      if (items.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'Нет новостей для публикации',
        });
      }

      // Pick the most recent item
      const topItem = items[0];
      const caption = generatePostFromRSSItem(topItem);

      const success = await sendMessageToChannel(caption);

      return NextResponse.json({
        success,
        message: success
          ? `Опубликовано: "${topItem.title}"`
          : 'Ошибка при публикации',
        item: topItem,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('RSS POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
