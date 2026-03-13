import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const CATEGORIES = [
  { value: 'RESTAURANT', label: '🍽️ Рестораны' },
  { value: 'CAFE', label: '☕ Кафе и кофейни' },
  { value: 'BAR', label: '🍺 Бары и пабы' },
  { value: 'FAST_FOOD', label: '🍔 Быстрое питание' },
  { value: 'HOTEL', label: '🏨 Отели' },
  { value: 'BEAUTY', label: '💅 Салоны красоты' },
  { value: 'FITNESS', label: '💪 Фитнес' },
  { value: 'SERVICE', label: '🚗 Услуги' },
  { value: 'HEALTH', label: '🏥 Здоровье' },
  { value: 'OTHER', label: '📦 Другое' },
];

export async function GET() {
  try {
    // Use simple findMany like places API
    const places = await db.place.findMany({
      select: { category: true, district: true }
    });
    
    const categoryCount: Record<string, number> = {};
    const districtCount: Record<string, number> = {};
    
    for (const p of places) {
      if (p.category) {
        categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
      }
      if (p.district) {
        districtCount[p.district!] = (districtCount[p.district!] || 0) + 1;
      }
    }

    const categories = CATEGORIES.map(c => ({
      ...c,
      count: categoryCount[c.value] || 0,
    })).sort((a, b) => b.count - a.count);

    const districts = Object.entries(districtCount)
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      categories,
      districts,
      totalPlaces: places.length,
    });
  } catch (error) {
    console.error('Filters error:', error);
    return NextResponse.json({ error: 'Failed to fetch filters' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, categories, districts, limit = 20, offset = 0 } = body;

    const where: any = {};

    if (query?.length >= 2) {
      where.OR = [
        { name: { contains: query } },
        { address: { contains: query } },
      ];
    }

    if (categories?.length) where.category = { in: categories };
    if (districts?.length) where.district = { in: districts };

    const places = await db.place.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { rating: 'desc' },
    });
    
    const total = await db.place.count({ where });

    return NextResponse.json({ places, total, hasMore: total > offset + limit });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
