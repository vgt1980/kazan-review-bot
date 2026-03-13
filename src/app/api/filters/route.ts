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

const DISTRICTS = [
  'Авиастроительный', 'Вахитовский', 'Кировский',
  'Московский', 'Ново-Савиновский', 'Приволжский', 'Советский',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'search') {
      const q = searchParams.get('q') || '';
      const category = searchParams.get('category');

      if (q.length < 2) {
        return NextResponse.json({ places: [], total: 0 });
      }

      const where: any = {
        name: { contains: q, mode: 'insensitive' },
      };
      if (category) where.category = category;

      const places = await db.place.findMany({
        where,
        take: 20,
        orderBy: { rating: 'desc' },
      });

      return NextResponse.json({ places, total: places.length });
    }

    // Get counts
    const total = await db.place.count();
    
    const categoryCounts = await db.place.groupBy({
      by: ['category'],
      _count: { id: true },
    });

    const districtCounts = await db.place.groupBy({
      by: ['district'],
      _count: { id: true },
    });

    const categoryMap = Object.fromEntries(
      categoryCounts.map(c => [c.category, c._count.id])
    );

    const districtMap = Object.fromEntries(
      districtCounts.filter(d => d.district).map(d => [d.district, d._count.id])
    );

    return NextResponse.json({
      categories: CATEGORIES.map(c => ({
        ...c,
        count: categoryMap[c.value] || 0,
      })).sort((a, b) => b.count - a.count),
      districts: DISTRICTS.map(d => ({
        value: d,
        label: d,
        count: districtMap[d] || 0,
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
