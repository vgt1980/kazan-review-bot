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

// GET - Get import stats
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
        byCategory: byCategory.map((c) => ({
          category: c.category,
          count: c._count.id,
        })),
      },
      sources: {
        openstreetmap: {
          name: 'OpenStreetMap',
          description: 'Бесплатная карта с данными о заведениях',
          url: 'https://overpass-api.de',
        },
      },
    });
  } catch (error) {
    console.error('Error getting import stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}

// POST - Import places from external sources
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, category, telegramId } = body;

    // Verify admin
    const adminIds = (process.env.ADMIN_IDS || '').split(',');
    if (!telegramId || !adminIds.includes(telegramId.toString())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (source !== 'osm') {
      return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
    }

    let osmPlaces: OSMPlace[] = [];
    let importCategory = category;

    // Fetch from OSM based on category
    switch (category) {
      case 'RESTAURANT':
        osmPlaces = await fetchRestaurantsFromOSM();
        break;
      case 'CAFE':
        osmPlaces = await fetchCafesFromOSM();
        break;
      case 'SHOP':
        osmPlaces = await fetchShopsFromOSM();
        break;
      case 'BEAUTY':
        osmPlaces = await fetchBeautyFromOSM();
        break;
      case 'SERVICE':
        osmPlaces = await fetchServicesFromOSM();
        break;
      default:
        // Fetch all types
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

    if (osmPlaces.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No places found',
      });
    }

    // Map Kazan districts based on coordinates
    const getDistrict = (lat: number, lon: number): string => {
      // Simplified district mapping
      if (lat > 55.78 && lon < 49.15) return 'Вахитовский';
      if (lat > 55.78 && lon >= 49.15) return 'Приволжский';
      if (lat <= 55.78 && lon < 49.15) return 'Московский';
      return 'Вахитовский'; // Default
    };

    // Import to database
    let added = 0;
    let skipped = 0;

    for (const place of osmPlaces) {
      // Check if already exists
      const existing = await db.place.findFirst({
        where: {
          name: place.name,
          address: formatOSMAddress(place),
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const placeCategory = importCategory || mapOSMToCategory(place);

      try {
        await db.place.create({
          data: {
            name: place.name,
            category: placeCategory as any,
            district: place.addr_city || getDistrict(place.lat, place.lon),
            address: formatOSMAddress(place),
            latitude: place.lat,
            longitude: place.lon,
          },
        });
        added++;
      } catch (e) {
        // Skip duplicates
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Импорт завершен! Добавлено: ${added}, пропущено: ${skipped}`,
      stats: {
        total: osmPlaces.length,
        added,
        skipped,
      },
    });
  } catch (error) {
    console.error('Error importing places:', error);
    return NextResponse.json(
      { error: 'Failed to import places' },
      { status: 500 }
    );
  }
}
