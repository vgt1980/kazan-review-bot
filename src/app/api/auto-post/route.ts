import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publishPlacePost, publishTopPlacesDigest } from '@/lib/auto-poster/telegram-poster';

// GET - Get auto-post settings and stats
export async function GET() {
  try {
    // Get stats
    const totalPlaces = await db.place.count();
    const placesWithReviews = await db.place.count({
      where: { reviewCount: { gt: 0 } },
    });

    // Get places by category
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

    // Verify admin
    const adminIds = (process.env.ADMIN_IDS || '').split(',');

    if (!telegramId || !adminIds.includes(telegramId.toString())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action === 'post_place' && placeId) {
      // Post about specific place
      const place = await db.place.findUnique({
        where: { id: placeId },
      });

      if (!place) {
        return NextResponse.json({ error: 'Place not found' }, { status: 404 });
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
      // Post category digest
      const places = await db.place.findMany({
        where: {
          category: category as any,
          reviewCount: { gt: 0 },
        },
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

    if (action === 'post_random') {
      // Post about random place with good rating
      const places = await db.place.findMany({
        where: {
          reviewCount: { gte: 1 },
          rating: { gte: 5 },
        },
        orderBy: { rating: 'desc' },
        take: 10,
      });

      if (places.length === 0) {
        // Pick any place
        const anyPlace = await db.place.findFirst({
          orderBy: { createdAt: 'desc' },
        });

        if (!anyPlace) {
          return NextResponse.json({ error: 'No places found' }, { status: 404 });
        }

        const result = await publishPlacePost({
          name: anyPlace.name,
          category: anyPlace.category,
          district: anyPlace.district,
          address: anyPlace.address,
          rating: anyPlace.rating,
          reviewCount: anyPlace.reviewCount,
        });

        return NextResponse.json(result);
      }

      // Pick random from top 10
      const randomPlace = places[Math.floor(Math.random() * places.length)];

      const result = await publishPlacePost({
        name: randomPlace.name,
        category: randomPlace.category,
        district: randomPlace.district,
        address: randomPlace.address,
        rating: randomPlace.rating,
        reviewCount: randomPlace.reviewCount,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in auto-post:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
