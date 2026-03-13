import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const CATEGORY_LABELS: Record<string, string> = {
  RESTAURANT: '🍽️ Рестораны',
  CAFE: '☕ Кафе и кофейни',
  BAR: '🍺 Бары и пабы',
  FAST_FOOD: '🍔 Быстрое питание',
  HOTEL: '🏨 Отели',
  SHOP: '🛍️ Магазины',
  BEAUTY: '💅 Салоны красоты',
  MALL: '🏬 Торговые центры',
  FITNESS: '💪 Фитнес',
  ENTERTAINMENT: '🎭 Развлечения',
  SERVICE: '🚗 Услуги',
  HEALTH: '🏥 Здоровье',
  OTHER: '📦 Другое',
};

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

    if (category) where.category = category;

    const places = await db.place.findMany({
      where,
      take: limit,
      orderBy: [{ rating: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, category: true, district: true, address: true, rating: true, reviewCount: true },
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, categories, districts, limit = 20, offset = 0 } = body;

    const where: any = {};

    if (query && query.length >= 2) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (categories?.length) where.category = { in: categories };
    if (districts?.length) where.district = { in: districts };

    const [places, total] = await Promise.all([
      db.place.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ rating: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true, category: true, district: true, address: true, rating: true, reviewCount: true },
      }),
      db.place.count({ where }),
    ]);

    return NextResponse.json({
      places: places.map(p => ({
        ...p,
        categoryLabel: CATEGORY_LABELS[p.category] || p.category,
      })),
      total,
      hasMore: total > offset + limit,
    });
  } catch (error) {
    console.error('Advanced search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
