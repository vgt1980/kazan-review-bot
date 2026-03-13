import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publishPlacePost, publishTopPlacesDigest } from '@/lib/auto-poster/telegram-poster';

// Admin IDs - hardcoded for reliability
const ADMIN_IDS = ['1892592914'];

// GET - Get auto-post settings and stats
export async function GET() {
  try {
    const totalPlaces = await db.place.count();
    const placesWithReviews = await db.place.count({
      where: { reviewCount: { gt: 0 } },
    });

    const placesByCategory = await db.place.groupBy({
      by: ['category'],
      _count: { id: true },
    });

    return NextResponse.json({
      stats: {
        totalPlaces,
        placesWithReviews,
        placesByCategory: placesByCategory.map((c) => ({
          category: c.category,
          count: c._count.id,
        })),
      },
      channelId: process.env.CHANNEL_ID?.trim(),
    });
  } catch (error) {
    console.error('Error getting auto-post stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}

// POST - Trigger auto-post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, placeId, category, telegramId } = body;

    // Verify admin - check both env and hardcoded
    const envAdminIds = (process.env.ADMIN_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    const allAdminIds = [...new Set([...ADMIN_IDS, ...envAdminIds])];
    const isAdmin = telegramId && allAdminIds.includes(String(telegramId).trim());

    if (!isAdmin) {
      console.log('Unauthorized access attempt:', { telegramId, adminIds: allAdminIds });
      return NextResponse.json({ error: 'Unauthorized', adminIds: allAdminIds, provided: telegramId }, { status: 403 });
    }

    console.log('Auto-post action:', action, 'by user:', telegramId);

    if (action === 'random') {
      // Post about random place
      const places = await db.place.findMany({
        where: { reviewCount: { gte: 1 }, rating: { gte: 5 } },
        orderBy: { rating: 'desc' },
        take: 10,
      });

      let placeToPost;
      
      if (places.length > 0) {
        placeToPost = places[Math.floor(Math.random() * places.length)];
      } else {
        // Fallback: any place
        placeToPost = await db.place.findFirst({ orderBy: { createdAt: 'desc' } });
      }

      if (!placeToPost) {
        return NextResponse.json({ success: false, message: 'Заведений не найдено' }, { status: 404 });
      }

      const result = await publishPlacePost({
        name: placeToPost.name,
        category: placeToPost.category,
        district: placeToPost.district,
        address: placeToPost.address,
        rating: placeToPost.rating,
        reviewCount: placeToPost.reviewCount,
      });

      return NextResponse.json(result);
    }

    if (action === 'post_place' && placeId) {
      const place = await db.place.findUnique({ where: { id: placeId } });

      if (!place) {
        return NextResponse.json({ success: false, message: 'Заведение не найдено' }, { status: 404 });
      }

      const result = await publishPlacePost({
        name: place.name,
        category: place.category,
        district: place.district,
        address: place.address,
        rating: place.rating,
        reviewCount: place.reviewCount,
      });

      return NextResponse.json(result);
    }

    if (action === 'post_digest' && category) {
      const places = await db.place.findMany({
        where: { category: category as any, reviewCount: { gt: 0 } },
        orderBy: { rating: 'desc' },
        take: 10,
      });

      const categoryNames: Record<string, string> = {
        RESTAURANT: 'Рестораны',
        CAFE: 'Кофейни',
        SHOP: 'Магазины',
        BEAUTY: 'Бьюти-салоны',
        MALL: 'Торговые центры',
        SERVICE: 'Сервисы',
        OTHER: 'Другое',
        HOTEL: 'Отели',
        ENTERTAINMENT: 'Развлечения',
        SPORT: 'Спорт',
        EDUCATION: 'Образование',
        HEALTH: 'Здоровье',
        TRANSPORT: 'Транспорт',
      };

      const result = await publishTopPlacesDigest(
        places.map((p) => ({
          name: p.name,
          category: p.category,
          district: p.district,
          rating: p.rating,
          reviewCount: p.reviewCount,
        })),
        categoryNames[category] || category
      );

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action. Use: random, post_place, post_digest' }, { status: 400 });
  } catch (error) {
    console.error('Error in auto-post:', error);
    return NextResponse.json(
      { success: false, message: `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
