import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { importAllFromOSM, importByCategory, getOSMStats, PlaceData } from '@/lib/data-sources/kazan-places';

/**
 * GET - Get import statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'stats') {
      // Get OSM stats
      const osmStats = await getOSMStats();

      // Get current DB stats
      const dbStats = {
        total: await prisma.place.count(),
        byCategory: {} as Record<string, number>,
      };

      const categories = await prisma.place.groupBy({
        by: ['category'],
        _count: { id: true },
      });

      for (const cat of categories) {
        dbStats.byCategory[cat.category] = cat._count.id;
      }

      return NextResponse.json({
        osm: osmStats,
        database: dbStats,
      });
    }

    if (action === 'preview') {
      // Preview what would be imported
      const category = searchParams.get('category');
      const places = category
        ? await importByCategory(category)
        : await importAllFromOSM();

      return NextResponse.json({
        count: places.length,
        sample: places.slice(0, 10),
      });
    }

    return NextResponse.json({
      error: 'Invalid action. Use ?action=stats or ?action=preview',
    }, { status: 400 });
  } catch (error) {
    console.error('Import GET error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

/**
 * POST - Import places to database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, category, telegramId } = body;

    // Verify admin
    const adminIds = (process.env.ADMIN_IDS || '').split(',');

    if (!telegramId || !adminIds.includes(telegramId.toString())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action === 'import_all') {
      // Import all places from OSM
      const places = await importAllFromOSM();

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const place of places) {
        try {
          // Check if exists
          const existing = await prisma.place.findFirst({
            where: {
              name: place.name,
              category: place.category as any,
            },
          });

          if (existing) {
            skipped++;
            continue;
          }

          // Create place
          await prisma.place.create({
            data: {
              name: place.name,
              category: place.category as any,
              address: place.address,
              district: place.district,
              latitude: place.latitude,
              longitude: place.longitude,
            },
          });

          imported++;
        } catch (error) {
          errors.push(`${place.name}: ${error}`);
        }
      }

      return NextResponse.json({
        success: true,
        imported,
        skipped,
        errors: errors.slice(0, 10),
      });
    }

    if (action === 'import_category' && category) {
      // Import specific category
      const places = await importByCategory(category);

      let imported = 0;
      let skipped = 0;

      for (const place of places) {
        try {
          const existing = await prisma.place.findFirst({
            where: {
              name: place.name,
              category: place.category as any,
            },
          });

          if (existing) {
            skipped++;
            continue;
          }

          await prisma.place.create({
            data: {
              name: place.name,
              category: place.category as any,
              address: place.address,
              district: place.district,
              latitude: place.latitude,
              longitude: place.longitude,
            },
          });

          imported++;
        } catch (error) {
          console.error(`Error importing ${place.name}:`, error);
        }
      }

      return NextResponse.json({
        success: true,
        category,
        imported,
        skipped,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Import POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process import' },
      { status: 500 }
    );
  }
}
