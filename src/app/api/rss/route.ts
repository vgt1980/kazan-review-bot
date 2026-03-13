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
const ADMIN_IDS = ['1892592914'];

/**
 * GET - Fetch RSS news about Kazan places
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxItems = parseInt(searchParams.get('max') || '15');
    const source = searchParams.get('source');

    if (source) {
      const feed = await parseRSSFeed(source);
      if (!feed) {
        return NextResponse.json({ error: 'Failed to fetch RSS feed' }, { status: 500 });
      }
      return NextResponse.json({ source: feed.title, items: feed.items.slice(0, maxItems) });
    }

    const items = await fetchKazanPlaceNews(maxItems);

    return NextResponse.json({
      success: true,
      count: items.length,
      sources: RSS_SOURCES.map(s => s.name),
      items,
    });
  } catch (error) {
    console.error('RSS API error:', error);
    return NextResponse.json({ error: 'Failed to process RSS request' }, { status: 500 });
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
    const envAdminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim()).filter(id => id);
    const allAdminIds = [...new Set([...ADMIN_IDS, ...envAdminIds])];
    
    if (!telegramId || !allAdminIds.includes(String(telegramId).trim())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action === 'fetch') {
      const items = await fetchKazanPlaceNews(20);
      return NextResponse.json({ success: true, count: items.length, items });
    }

    if (action === 'publish' && item) {
      const rssItem: RSSItem = item;
      const caption = generatePostFromRSSItem(rssItem);

      let success = false;

      // Generate image if requested or use existing
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

      if (imageBase64) {
        success = await sendPhotoToChannel(imageBase64, caption);
      } else if (rssItem.imageUrl) {
        // Try to use existing image from RSS
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

    if (action === 'publish_latest') {
      const items = await fetchKazanPlaceNews(5);

      if (items.length === 0) {
        return NextResponse.json({ success: false, message: 'Нет новостей для публикации' });
      }

      const topItem = items[0];
      const caption = generatePostFromRSSItem(topItem);

      // Try to get image
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

    return NextResponse.json({ error: 'Invalid action. Use: fetch, publish, publish_latest' }, { status: 400 });
  } catch (error) {
    console.error('RSS POST error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
