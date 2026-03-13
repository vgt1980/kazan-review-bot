import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  RESTAURANT: '🍽️ Рестораны',
  CAFE: '☕ Кафе и кофейни',
  BAR: '🍺 Бары и пабы',
  FAST_FOOD: '🍔 Быстрое питание',
  HOTEL: '🏨 Отели и гостиницы',
  SHOP: '🛍️ Магазины',
  BEAUTY: '💅 Салоны красоты',
  MALL: '🏬 Торговые центры',
  FITNESS: '💪 Фитнес и спорт',
  ENTERTAINMENT: '🎭 Развлечения',
  SERVICE: '🚗 Услуги',
  HEALTH: '🏥 Здоровье',
  EDUCATION: '📚 Образование',
  TRANSPORT: '🚕 Транспорт',
  OTHER: '📦 Другое',
};

/**
 * GET - Quick search for places (autocomplete)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (query.length < 2) {
      return NextResponse.json({ places: [], total: 0 });
    }

    const where: any = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (category) {
      where.category = category;
    }

    const places = await db.place.findMany({
      where,
      take: limit,
      orderBy: [
        { rating: 'desc' },
        { reviewCount: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        category: true,
        district: true,
        address: true,
        rating: true,
        reviewCount: true,
        imageUrl: true,
      },
    });

    return NextResponse.json({
      places: places.map(p => ({
        ...p,
        categoryLabel: CATEGORY_LABELS[p.category] || p.category,
      })),
      total: places.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

/**
 * POST - Advanced search with filters and sorting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      categories,
      districts,
      minRating,
      maxRating,
      sortBy = 'rating',
      sortOrder = 'desc',
      limit = 20,
      offset = 0,
    } = body;

    const where: any = {};

    // Text search
    if (query && query.length >= 2) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Multiple categories
    if (categories && categories.length > 0) {
      where.category = { in: categories };
    }

    // Multiple districts
    if (districts && districts.length > 0) {
      where.district = { in: districts };
    }

    // Rating range
    if (minRating || maxRating) {
      where.rating = {};
      if (minRating) where.rating.gte = parseFloat(minRating);
      if (maxRating) where.rating.lte = parseFloat(maxRating);
    }

    // Sorting
    const orderBy: any[] = [];
    switch (sortBy) {
      case 'rating':
        orderBy.push({ rating: sortOrder });
        orderBy.push({ reviewCount: 'desc' });
        break;
      case 'reviews':
        orderBy.push({ reviewCount: sortOrder });
        orderBy.push({ rating: 'desc' });
        break;
      case 'name':
        orderBy.push({ name: sortOrder });
        break;
      case 'newest':
        orderBy.push({ createdAt: sortOrder });
        break;
      default:
        orderBy.push({ rating: 'desc' });
    }

    const [places, total] = await Promise.all([
      db.place.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy,
        select: {
          id: true,
          name: true,
          category: true,
          district: true,
          address: true,
          rating: true,
          reviewCount: true,
          imageUrl: true,
          phone: true,
          website: true,
          description: true,
          createdAt: true,
        },
      }),
      db.place.count({ where }),
    ]);

    // Get counts for stats
    const stats = await db.place.aggregate({
      where,
      _count: { id: true },
      _avg: { rating: true },
    });

    return NextResponse.json({
      places: places.map(p => ({
        ...p,
        categoryLabel: CATEGORY_LABELS[p.category] || p.category,
      })),
      total,
      hasMore: total > offset + limit,
      stats: {
        total: stats._count.id,
        avgRating: stats._avg.rating?.toFixed(1) || 0,
      },
    });
  } catch (error) {
    console.error('Advanced search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
