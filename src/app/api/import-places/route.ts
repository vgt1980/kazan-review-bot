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
import {
  searchByCategory,
  importAllFrom2GIS,
  get2GISCategories,
  is2GISConfigured,
  type TwoGISPlace,
} from '@/lib/data-sources/twogis-api';

// GET - Get import stats
export async function GET() {
  try {
    const totalPlaces = await db.place.count();
    const byCategory = await db.place.groupBy({
      by: ['category'],
      _count: { id: true },
    });

    const categories2GIS = get2GISCategories();

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
          available: true,
        },
        twogis: {
          name: '2ГИС',
          description: 'Справочник организаций с подробной информацией',
          url: 'https://2gis.ru/kazan',
          available: true,
          apiConfigured: is2GISConfigured(),
          categories: categories2GIS,
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
    const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim());
    if (!telegramId || !adminIds.includes(telegramId.toString())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (source === 'osm') {
      return await importFromOSM(category);
    } else if (source === 'twogis') {
      return await importFrom2GIS(category);
    } else if (source === 'all') {
      // Import from all sources
      const osmResult = await importFromOSM(category);
      const twogisResult = await importFrom2GIS(category);
      
      return NextResponse.json({
        success: true,
        message: 'Импорт из всех источников завершен',
        results: {
          osm: await osmResult.json(),
          twogis: await twogisResult.json(),
        },
      });
    }

    return NextResponse.json({ error: 'Unknown source. Use: osm, twogis, or all' }, { status: 400 });
  } catch (error) {
    console.error('Error importing places:', error);
    return NextResponse.json(
      { error: 'Failed to import places' },
      { status: 500 }
    );
  }
}

// Import from OpenStreetMap
async function importFromOSM(category: string | null): Promise<NextResponse> {
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
      message: 'No places found in OSM',
      source: 'openstreetmap',
    });
  }

  // Map Kazan districts based on coordinates
  const getDistrict = (lat: number, lon: number): string => {
    if (lat > 55.78 && lon < 49.15) return 'Вахитовский';
    if (lat > 55.78 && lon >= 49.15) return 'Приволжский';
    if (lat <= 55.78 && lon < 49.15) return 'Московский';
    return 'Вахитовский';
  };

  let added = 0;
  let skipped = 0;

  for (const place of osmPlaces) {
    if (!place.name) continue;
    
    const address = formatOSMAddress(place);
    const existing = await db.place.findFirst({
      where: { name: place.name, address },
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
          address,
          latitude: place.lat,
          longitude: place.lon,
          phone: place.phone,
          website: place.website,
        },
      });
      added++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({
    success: true,
    source: 'openstreetmap',
    message: `Импорт из OSM завершен! Добавлено: ${added}, пропущено: ${skipped}`,
    stats: { total: osmPlaces.length, added, skipped },
  });
}

// Import from 2GIS
async function importFrom2GIS(category: string | null): Promise<NextResponse> {
  let places: TwoGISPlace[] = [];

  if (category) {
    // Import specific category
    const validCategories = Object.keys(get2GISCategories().reduce((acc, c) => ({ ...acc, [c.id]: true }), {} as Record<string, boolean>));
    
    if (!validCategories.includes(category)) {
      return NextResponse.json({
        success: false,
        message: `Invalid category. Available: ${validCategories.join(', ')}`,
        source: 'twogis',
      }, { status: 400 });
    }

    places = await searchByCategory(category as any, 50);
  } else {
    // Import all categories
    places = await importAllFrom2GIS(30);
  }

  if (places.length === 0) {
    return NextResponse.json({
      success: false,
      message: 'No places found in 2GIS',
      source: 'twogis',
    });
  }

  let added = 0;
  let skipped = 0;

  // Category mapping from 2GIS to our categories
  const categoryMap: Record<string, string> = {
    'Рестораны': 'RESTAURANT',
    'Кафе и кофейни': 'CAFE',
    'Быстрое питание': 'RESTAURANT',
    'Салоны красоты': 'BEAUTY',
    'СПА и массаж': 'BEAUTY',
    'Ветклиники и зоосалоны': 'SERVICE',
    'Фитнес и спорт': 'SERVICE',
    'Отели': 'SERVICE',
    'Магазины': 'SHOP',
    'Торговые центры': 'MALL',
    'Автоуслуги': 'SERVICE',
    'Аптеки': 'SERVICE',
    'Банки': 'SERVICE',
  };

  for (const place of places) {
    if (!place.name) continue;
    
    const existing = await db.place.findFirst({
      where: { 
        name: place.name, 
        address: place.address || '' 
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Determine category
    let placeCategory = category || 'RESTAURANT';
    if (place.categories?.length) {
      for (const cat of place.categories) {
        if (categoryMap[cat]) {
          placeCategory = categoryMap[cat];
          break;
        }
      }
    }

    try {
      await db.place.create({
        data: {
          name: place.name,
          category: placeCategory as any,
          district: extractDistrict(place.address || ''),
          address: place.address,
          latitude: place.location?.lat,
          longitude: place.location?.lon,
          phone: place.contacts?.phones?.[0]?.number,
          website: place.contacts?.websites?.[0]?.url,
          imageUrl: place.photos?.[0]?.url,
          externalId: place.id,
        },
      });
      added++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({
    success: true,
    source: 'twogis',
    message: `Импорт из 2ГИС завершен! Добавлено: ${added}, пропущено: ${skipped}`,
    stats: { total: places.length, added, skipped },
  });
}

// Extract district from address
function extractDistrict(address: string): string {
  const districts = [
    'Авиастроительный', 'Вахитовский', 'Кировский',
    'Московский', 'Ново-Савиновский', 'Приволжский', 'Советский',
  ];
  
  for (const district of districts) {
    if (address.toLowerCase().includes(district.toLowerCase())) {
      return district;
    }
  }
  
  return 'Вахитовский'; // Default
}
