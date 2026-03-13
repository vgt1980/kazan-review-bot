import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  fetchRestaurantsFromOSM,
  fetchCafesFromOSM,
  fetchShopsFromOSM,
  fetchBeautyFromOSM,
  fetchServicesFromOSM,
  mapOSMToCategory,
  formatOSMAddress,
  type OSMPlace,
} from '@/lib/data-sources/openstreetmap';

export async function GET() {
  try {
    const totalPlaces = await db.place.count();
    const byCategory = await db.place.groupBy({
      by: ['category'],
      _count: { id: true },
    });

    return NextResponse.json({
      current: {
        total: totalPlaces,
        byCategory: byCategory.map(c => ({ category: c.category, count: c._count.id })),
      },
      sources: {
        openstreetmap: { name: 'OpenStreetMap', available: true },
        twogis: { name: '2ГИС', available: true },
      },
    });
  } catch (error) {
    console.error('Error getting import stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, category, telegramId } = body;

    const adminIds = (process.env.ADMIN_IDS || '1892592914').split(',').map(id => id.trim());
    if (!telegramId || !adminIds.includes(telegramId.toString())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (source !== 'osm') {
      return NextResponse.json({ error: 'Use 2GIS import script instead' }, { status: 400 });
    }

    let osmPlaces: OSMPlace[] = [];
    let importCategory = category;

    switch (category) {
      case 'RESTAURANT': osmPlaces = await fetchRestaurantsFromOSM(); break;
      case 'CAFE': osmPlaces = await fetchCafesFromOSM(); break;
      case 'SHOP': osmPlaces = await fetchShopsFromOSM(); break;
      case 'BEAUTY': osmPlaces = await fetchBeautyFromOSM(); break;
      case 'SERVICE': osmPlaces = await fetchServicesFromOSM(); break;
      default:
        const [restaurants, cafes, shops, beauty, services] = await Promise.all([
          fetchRestaurantsFromOSM(),
          fetchCafesFromOSM(),
          fetchShopsFromOSM(),
          fetchBeautyFromOSM(),
          fetchServicesFromOSM(),
        ]);
        osmPlaces = [...restaurants, ...cafes, ...shops, ...beauty, ...services];
        importCategory = null;
    }

    if (!osmPlaces.length) {
      return NextResponse.json({ success: false, message: 'No places found' });
    }

    let added = 0, skipped = 0;

    for (const place of osmPlaces) {
      if (!place.name) continue;
      
      const address = formatOSMAddress(place);
      const existing = await db.place.findFirst({
        where: { name: place.name, address },
      });

      if (existing) { skipped++; continue; }

      try {
        await db.place.create({
          data: {
            name: place.name,
            category: (importCategory || mapOSMToCategory(place)) as any,
            district: place.addr_city,
            address,
            latitude: place.lat,
            longitude: place.lon,
          },
        });
        added++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Импорт завершен! Добавлено: ${added}, пропущено: ${skipped}`,
      stats: { total: osmPlaces.length, added, skipped },
    });
  } catch (error) {
    console.error('Error importing places:', error);
    return NextResponse.json({ error: 'Failed to import places' }, { status: 500 });
  }
}
