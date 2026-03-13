import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// All available categories with labels
const ALL_CATEGORIES = [
  { value: 'RESTAURANT', label: '🍽️ Рестораны', icon: '🍽️' },
  { value: 'CAFE', label: '☕ Кафе и кофейни', icon: '☕' },
  { value: 'BAR', label: '🍺 Бары и пабы', icon: '🍺' },
  { value: 'FAST_FOOD', label: '🍔 Быстрое питание', icon: '🍔' },
  { value: 'HOTEL', label: '🏨 Отели и гостиницы', icon: '🏨' },
  { value: 'SHOP', label: '🛍️ Магазины', icon: '🛍️' },
  { value: 'BEAUTY', label: '💅 Салоны красоты', icon: '💅' },
  { value: 'MALL', label: '🏬 Торговые центры', icon: '🏬' },
  { value: 'FITNESS', label: '💪 Фитнес и спорт', icon: '💪' },
  { value: 'ENTERTAINMENT', label: '🎭 Развлечения', icon: '🎭' },
  { value: 'SERVICE', label: '🚗 Услуги', icon: '🚗' },
  { value: 'HEALTH', label: '🏥 Здоровье', icon: '🏥' },
  { value: 'EDUCATION', label: '📚 Образование', icon: '📚' },
  { value: 'TRANSPORT', label: '🚕 Транспорт', icon: '🚕' },
  { value: 'OTHER', label: '📦 Другое', icon: '📦' },
];

// Kazan districts
const KAZAN_DISTRICTS = [
  { value: 'Авиастроительный', label: 'Авиастроительный' },
  { value: 'Вахитовский', label: 'Вахитовский' },
  { value: 'Кировский', label: 'Кировский' },
  { value: 'Московский', label: 'Московский' },
  { value: 'Ново-Савиновский', label: 'Ново-Савиновский' },
  { value: 'Приволжский', label: 'Приволжский' },
  { value: 'Советский', label: 'Советский' },
];

/**
 * GET - Get filter options for places
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Search places
    if (action === 'search') {
      const query = searchParams.get('q') || '';
      const category = searchParams.get('category');
      const district = searchParams.get('district');
      const limit = parseInt(searchParams.get('limit') || '20');

      if (!query || query.length < 2) {
        return NextResponse.json({ places: [], total: 0 });
      }

      const where: any = {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      };

      if (category) {
        where.category = category;
      }

      if (district) {
        where.district = district;
      }

      const [places, total] = await Promise.all([
        db.place.findMany({
          where,
          take: limit,
          orderBy: [
            { rating: 'desc' },
            { reviewCount: 'desc' },
            { name: 'asc' },
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
        }),
        db.place.count({ where }),
      ]);

      return NextResponse.json({
        places: places.map(p => ({
          ...p,
          categoryLabel: ALL_CATEGORIES.find(c => c.value === p.category)?.label || p.category,
        })),
        total,
      });
    }

    // Get unique values from database
    const places = await db.place.findMany({
      select: { category: true, district: true }
    });

    // Count by category
    const categoryCount: Record<string, number> = {};
    const districtCount: Record<string, number> = {};

    places.forEach(place => {
      if (place.category) {
        categoryCount[place.category] = (categoryCount[place.category] || 0) + 1;
      }
      if (place.district) {
        districtCount[place.district] = (districtCount[place.district] || 0) + 1;
      }
    });

    // Build categories list with counts
    const categories = ALL_CATEGORIES.map(cat => ({
      value: cat.value,
      label: cat.label,
      icon: cat.icon,
      count: categoryCount[cat.value] || 0,
    })).sort((a, b) => b.count - a.count);

    // Build districts list with counts
    const districts = KAZAN_DISTRICTS.map(d => ({
      value: d.value,
      label: d.label,
      count: districtCount[d.value] || 0,
    })).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      categories,
      districts,
      totalPlaces: places.length,
      // All available options (including empty ones)
      allCategories: ALL_CATEGORIES,
      allDistricts: KAZAN_DISTRICTS,
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filters' },
      { status: 500 }
    );
  }
}

/**
 * POST - Search places with filters
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, category, district, rating, limit = 20, offset = 0 } = body;

    const where: any = {};

    // Text search
    if (query && query.length >= 2) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (category) {
      where.category = category;
    }

    // District filter
    if (district) {
      where.district = district;
    }

    // Rating filter
    if (rating) {
      where.rating = { gte: parseFloat(rating) };
    }

    const [places, total] = await Promise.all([
      db.place.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [
          { rating: 'desc' },
          { reviewCount: 'desc' },
          { name: 'asc' },
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
          phone: true,
          website: true,
        },
      }),
      db.place.count({ where }),
    ]);

    return NextResponse.json({
      places: places.map(p => ({
        ...p,
        categoryLabel: ALL_CATEGORIES.find(c => c.value === p.category)?.label || p.category,
      })),
      total,
      hasMore: total > offset + limit,
    });
  } catch (error) {
    console.error('Error searching places:', error);
    return NextResponse.json(
      { error: 'Failed to search places' },
      { status: 500 }
    );
  }
}
