import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  searchAllPages,
  search2GIS,
  SEARCH_QUERIES,
  mapRubricToCategory,
  extractDistrictFromAddress,
  type TwoGISPlace,
  getAPIKeyStatus,
} from '@/lib/data-sources/twogis-api';

// Track import progress
let importProgress = {
  status: 'idle',
  totalProcessed: 0,
  totalAdded: 0,
  totalSkipped: 0,
  currentCategory: '',
  errors: [] as string[],
  startedAt: null as Date | null,
  finishedAt: null as Date | null,
};

/**
 * GET - Get import status or start import
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Check API key status
  if (action === 'status') {
    return NextResponse.json({
      api: getAPIKeyStatus(),
      progress: importProgress,
      dbStats: await getDBStats(),
    });
  }

  // Preview what will be imported
  if (action === 'preview') {
    const category = searchParams.get('category') || 'RESTAURANT';
    const queries = SEARCH_QUERIES[category as keyof typeof SEARCH_QUERIES] || [];
    
    return NextResponse.json({
      category,
      queries,
      api: getAPIKeyStatus(),
    });
  }

  // Test single search
  if (action === 'test') {
    const query = searchParams.get('query') || 'ресторан';
    const result = await search2GIS(query, 1, 10);
    
    return NextResponse.json({
      query,
      ...result,
      api: getAPIKeyStatus(),
    });
  }

  return NextResponse.json({
    message: 'Use action=status, preview, or test',
    progress: importProgress,
  });
}

/**
 * POST - Run import
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, telegramId, categories, maxPagesPerQuery } = body;

    // Verify admin
    const adminIds = (process.env.ADMIN_IDS || '1892592914').split(',').map(id => id.trim());
    if (!telegramId || !adminIds.includes(String(telegramId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Start import
    if (action === 'start') {
      if (importProgress.status === 'running') {
        return NextResponse.json({ 
          error: 'Import already running', 
          progress: importProgress 
        });
      }

      // Reset progress
      importProgress = {
        status: 'running',
        totalProcessed: 0,
        totalAdded: 0,
        totalSkipped: 0,
        currentCategory: 'starting...',
        errors: [],
        startedAt: new Date(),
        finishedAt: null,
      };

      // Run import in background (fire and forget)
      runImport(categories, maxPagesPerQuery || 3).catch(error => {
        console.error('Import error:', error);
        importProgress.status = 'error';
        importProgress.errors.push(error.message);
        importProgress.finishedAt = new Date();
      });

      return NextResponse.json({ 
        message: 'Import started',
        progress: importProgress,
      });
    }

    // Stop import
    if (action === 'stop') {
      if (importProgress.status === 'running') {
        importProgress.status = 'stopped';
        importProgress.finishedAt = new Date();
      }
      return NextResponse.json({ 
        message: 'Import stopped',
        progress: importProgress,
      });
    }

    // Quick import - single category
    if (action === 'import_category') {
      const category = body.category;
      if (!category) {
        return NextResponse.json({ error: 'Category required' }, { status: 400 });
      }

      const result = await importCategory(category, maxPagesPerQuery || 3);
      
      return NextResponse.json({
        success: true,
        category,
        ...result,
      });
    }

    // Import all places
    if (action === 'import_all') {
      importProgress = {
        status: 'running',
        totalProcessed: 0,
        totalAdded: 0,
        totalSkipped: 0,
        currentCategory: 'starting...',
        errors: [],
        startedAt: new Date(),
        finishedAt: null,
      };

      runImportAll(maxPagesPerQuery || 2).catch(error => {
        console.error('Import all error:', error);
        importProgress.status = 'error';
        importProgress.errors.push(error.message);
        importProgress.finishedAt = new Date();
      });

      return NextResponse.json({ 
        message: 'Full import started',
        progress: importProgress,
      });
    }

    return NextResponse.json({ 
      error: 'Invalid action. Use: start, stop, import_category, import_all' 
    }, { status: 400 });
  } catch (error: any) {
    console.error('Import API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Run full import for selected categories
 */
async function runImport(categories?: string[], maxPages: number = 3) {
  const categoriesToImport = categories || Object.keys(SEARCH_QUERIES);
  
  for (const category of categoriesToImport) {
    if (importProgress.status !== 'running') break;
    
    try {
      importProgress.currentCategory = category;
      
      const result = await importCategory(category, maxPages);
      
      importProgress.totalProcessed += result.processed;
      importProgress.totalAdded += result.added;
      importProgress.totalSkipped += result.skipped;
      
      console.log(`Category ${category}: +${result.added} added, ${result.skipped} skipped`);
    } catch (error: any) {
      console.error(`Error importing ${category}:`, error);
      importProgress.errors.push(`${category}: ${error.message}`);
    }
  }
  
  importProgress.status = 'completed';
  importProgress.finishedAt = new Date();
}

/**
 * Import all categories with all queries
 */
async function runImportAll(maxPages: number = 2) {
  const allCategories = Object.keys(SEARCH_QUERIES);
  await runImport(allCategories, maxPages);
}

/**
 * Import a single category
 */
async function importCategory(
  category: string,
  maxPages: number = 3
): Promise<{ processed: number; added: number; skipped: number }> {
  const queries = SEARCH_QUERIES[category as keyof typeof SEARCH_QUERIES];
  
  if (!queries) {
    throw new Error(`Unknown category: ${category}`);
  }

  let processed = 0;
  let added = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const query of queries) {
    console.log(`Searching: ${query}`);
    
    const places = await searchAllPages(query, maxPages);
    
    for (const place of places) {
      processed++;
      
      // Skip duplicates
      const key = `${place.name}_${place.address || ''}`.toLowerCase();
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);

      // Check if already in DB
      try {
        const existing = await db.place.findFirst({
          where: {
            OR: [
              { externalId: place.id },
              { 
                name: place.name,
                address: place.address || '',
              },
            ],
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Determine category
        const placeCategory = mapRubricToCategory(place.rubrics || [], query);
        const district = extractDistrictFromAddress(place.address || '');

        // Create place
        await db.place.create({
          data: {
            name: place.name,
            category: placeCategory as any,
            district: district,
            address: place.address,
            latitude: place.location?.lat,
            longitude: place.location?.lon,
            phone: place.contacts?.phones?.[0]?.number,
            website: place.contacts?.websites?.[0]?.url,
            imageUrl: place.photos?.[0]?.url,
            externalId: place.id,
            source: 'twogis',
            rating: place.rating?.score || 0,
          },
        });

        added++;
      } catch (error: any) {
        // Skip duplicates silently
        if (error.code === 'P2002') {
          skipped++;
        } else {
          console.error(`Error saving ${place.name}:`, error.message);
        }
      }
    }

    // Delay between queries
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return { processed, added, skipped };
}

/**
 * Get database stats
 */
async function getDBStats() {
  try {
    const total = await db.place.count();
    const byCategory = await db.place.groupBy({
      by: ['category'],
      _count: { id: true },
    });
    const bySource = await db.place.groupBy({
      by: ['source'],
      _count: { id: true },
    });

    return {
      total,
      byCategory: byCategory.map(c => ({ category: c.category, count: c._count.id })),
      bySource: bySource.map(s => ({ source: s.source, count: s._count.id })),
    };
  } catch {
    return { total: 0, byCategory: [], bySource: [] };
  }
}
