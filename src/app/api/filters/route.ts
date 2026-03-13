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

export async function GET(request: NextRequest) {
  try {
    // Simple count - without groupBy
    const total = await db.place.count();
    
    // Count by category manually
    const allPlaces = await db.place.findMany({
      select: { category: true, district: true }
    });
    
    const categoryCount: Record<string, number> = {};
    const districtCount: Record<string, number> = {};
    
    for (const p of allPlaces) {
      if (p.category) {
        categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
      }
      if (p.district) {
        districtCount[p.district] = (districtCount[p.district] || 0) + 1;
      }
    }

    return NextResponse.json({
      categories: CATEGORIES.map(c => ({
        ...c,
        count: categoryCount[c.value] || 0,
      })).sort((a, b) => b.count - a.count),
      districts: Object.entries(districtCount).map(([value, count]) => ({
        value,
        label: value,
        count,
      })).sort((a, b) => b.count - a.count),
      totalPlaces: total,
    });
  } catch (error) {
    console.error('Filters error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, categories, districts, limit = 20, offset = 0 } = await request.json();

    const where: any = {};

    if (query?.length >= 2) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (categories?.length) where.category = { in: categories };
    if (districts?.length) where.district = { in: districts };

    const [places, total] = await Promise.all([
      db.place.findMany({ where, take: limit, skip: offset, orderBy: { rating: 'desc' } }),
      db.place.count({ where }),
    ]);

    return NextResponse.json({ places, total, hasMore: total > offset + limit });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
