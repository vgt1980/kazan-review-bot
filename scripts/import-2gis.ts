/**
 * Direct import script for 2GIS places
 * Run: npx tsx scripts/import-2gis.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TWOGIS_API_KEY = '629f0d11-ac03-44b8-893b-c772f057c68f';
const TWOGIS_API_URL = 'https://catalog.api.2gis.ru';

// Search queries by category
const SEARCH_QUERIES: Record<string, string[]> = {
  RESTAURANT: [
    'ресторан',
    'кафе',
    'бар',
    'паб',
    'кофейня',
    'стейкхаус',
    'итальянский ресторан',
    'японский ресторан',
    'грузинский ресторан',
    'узбекский ресторан',
  ],
  CAFE: [
    'кафе',
    'кофейня',
    'пекарня',
    'кондитерская',
    'чайная',
    'кофе с собой',
  ],
  BAR: [
    'бар',
    'паб',
    'винотека',
    'спикизи',
    'крафт',
  ],
  FAST_FOOD: [
    'фастфуд',
    'бургерная',
    'пицца',
    'суши',
    'шаурма',
    'шаверма',
    'доставка еды',
  ],
  BEAUTY: [
    'салон красоты',
    'парикмахерская',
    'барбершоп',
    'ногтевая студия',
    'визажист',
    'косметолог',
    'перманентный макияж',
    'брови',
    'ресницы',
  ],
  SPA: [
    'спа салон',
    'массаж',
    'массажный салон',
  ],
  VET: [
    'ветеринарная клиника',
    'ветклиника',
    'зооклиника',
    'зоосалон',
    'груминг',
  ],
  FITNESS: [
    'фитнес клуб',
    'спортзал',
    'тренажерный зал',
    'бассейн',
    'йога',
    'пилатес',
    'кроссфит',
    'танцы',
  ],
  HOTEL: [
    'отель',
    'гостиница',
    'хостел',
    'мини-отель',
  ],
  MALL: [
    'торговый центр',
    'ТЦ',
    'молл',
  ],
  AUTO_SERVICE: [
    'автосервис',
    'СТО',
    'автомастерская',
    'авторемонт',
    'шиномонтаж',
    'автоэлектрик',
    'диагностика авто',
  ],
  CAR_WASH: [
    'автомойка',
    'мойка самообслуживания',
    'детейлинг',
  ],
  PHARMACY: [
    'аптека',
  ],
  HEALTH: [
    'стоматология',
    'зубная клиника',
    'медцентр',
    'медицинский центр',
    'поликлиника',
  ],
};

interface TwoGISItem {
  id: string;
  name: string;
  type: string;
  address_name?: string;
  point?: { lat: number; lon: number };
  contacts?: {
    phones?: { number: string }[];
    websites?: { url: string }[];
  };
  rating?: { score?: number; value?: number; reviews_count?: number };
  photos?: { url?: string }[];
  rubrics?: { name: string }[];
}

async function search2GIS(query: string, page: number = 1): Promise<{ items: TwoGISItem[]; total: number }> {
  const searchQuery = `${query} Казань`;
  
  const params = new URLSearchParams({
    q: searchQuery,
    page_size: '10',
    page: String(page),
    key: TWOGIS_API_KEY,
    fields: 'items.point,items.address,items.contacts,items.rating,items.photos,items.rubrics',
    sort: 'rating',
  });

  const response = await fetch(`${TWOGIS_API_URL}/3.0/items?${params}`);
  const data = await response.json();

  if (data.meta?.code !== 200) {
    console.error('API error:', data.meta?.error);
    return { items: [], total: 0 };
  }

  return {
    items: data.result?.items || [],
    total: data.result?.total || 0,
  };
}

function mapCategory(rubrics: string[], query: string): string {
  const text = (rubrics || []).join(' ').toLowerCase();
  const q = query.toLowerCase();
  
  if (text.includes('ресторан')) return 'RESTAURANT';
  if (text.includes('кафе')) return 'CAFE';
  if (text.includes('бар') || text.includes('паб')) return 'BAR';
  if (text.includes('кофейня') || text.includes('пекарня')) return 'CAFE';
  if (text.includes('фастфуд') || text.includes('бургер') || text.includes('пицца')) return 'FAST_FOOD';
  if (text.includes('суши')) return 'FAST_FOOD';
  if (text.includes('салон красоты') || text.includes('парикмахерская')) return 'BEAUTY';
  if (text.includes('барбершоп')) return 'BEAUTY';
  if (text.includes('ногт') || text.includes('маникюр')) return 'BEAUTY';
  if (text.includes('массаж') || text.includes('спа')) return 'BEAUTY';
  if (text.includes('косметолог') || text.includes('визаж')) return 'BEAUTY';
  if (text.includes('ветеринар') || text.includes('зоо')) return 'SERVICE';
  if (text.includes('фитнес') || text.includes('спортзал') || text.includes('тренажер')) return 'FITNESS';
  if (text.includes('бассейн')) return 'FITNESS';
  if (text.includes('йога') || text.includes('пилатес') || text.includes('танц')) return 'FITNESS';
  if (text.includes('отель') || text.includes('гостиница') || text.includes('хостел')) return 'HOTEL';
  if (text.includes('торговый центр') || text.includes('тц') || text.includes('молл')) return 'MALL';
  if (text.includes('аптек')) return 'HEALTH';
  if (text.includes('стоматолог') || text.includes('зубн')) return 'HEALTH';
  if (text.includes('медцентр') || text.includes('поликлиник')) return 'HEALTH';
  if (text.includes('автосервис') || text.includes('сто') || text.includes('автомастерск')) return 'SERVICE';
  if (text.includes('автомойка') || text.includes('мойка')) return 'SERVICE';
  if (text.includes('шиномонтаж')) return 'SERVICE';
  if (text.includes('супермаркет') || text.includes('магазин')) return 'SHOP';
  
  // By query
  if (q.includes('ресторан')) return 'RESTAURANT';
  if (q.includes('кафе')) return 'CAFE';
  if (q.includes('бар')) return 'BAR';
  if (q.includes('бьюти') || q.includes('салон')) return 'BEAUTY';
  if (q.includes('мойк')) return 'SERVICE';
  if (q.includes('авто')) return 'SERVICE';
  if (q.includes('фитнес') || q.includes('спорт')) return 'FITNESS';
  if (q.includes('отель') || q.includes('гостин')) return 'HOTEL';
  
  return 'OTHER';
}

function extractDistrict(address: string): string | null {
  if (!address) return null;
  
  const districts = [
    'Авиастроительный', 'Вахитовский', 'Кировский',
    'Московский', 'Ново-Савиновский', 'Приволжский', 'Советский',
  ];
  
  const addrLower = address.toLowerCase();
  
  for (const d of districts) {
    if (addrLower.includes(d.toLowerCase())) return d;
  }
  
  // Infer from streets
  if (addrLower.includes('баумана') || addrLower.includes('университетск') || addrLower.includes('пушкина')) return 'Вахитовский';
  if (addrLower.includes('победы') || addrLower.includes('фучика')) return 'Приволжский';
  if (addrLower.includes('ямашева') || addrLower.includes('ленинская')) return 'Московский';
  if (addrLower.includes('чуйкова') || addrLower.includes('линдора')) return 'Ново-Савиновский';
  
  return null;
}

async function importCategory(category: string, queries: string[], maxPages: number = 2) {
  console.log(`\n=== Importing ${category} ===`);
  
  let added = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const query of queries) {
    console.log(`Searching: ${query}`);
    
    for (let page = 1; page <= maxPages; page++) {
      const { items, total } = await search2GIS(query, page);
      
      if (items.length === 0) break;
      
      console.log(`  Page ${page}: ${items.length} items`);
      
      for (const item of items) {
        const key = `${item.name}_${item.address_name || ''}`.toLowerCase();
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);

        try {
          // Check existing
          const existing = await prisma.place.findFirst({
            where: {
              OR: [
                { externalId: item.id },
                { name: item.name, address: item.address_name || '' },
              ],
            },
          });

          if (existing) {
            skipped++;
            continue;
          }

          const placeCategory = mapCategory(item.rubrics?.map(r => r.name) || [], query);
          const district = extractDistrict(item.address_name || '');

          await prisma.place.create({
            data: {
              name: item.name,
              category: placeCategory as any,
              district,
              address: item.address_name,
              latitude: item.point?.lat,
              longitude: item.point?.lon,
              phone: item.contacts?.phones?.[0]?.number,
              website: item.contacts?.websites?.[0]?.url,
              imageUrl: item.photos?.[0]?.url,
              externalId: item.id,
              source: 'twogis',
              rating: item.rating?.score || item.rating?.value || 0,
            },
          });

          added++;
        } catch (e: any) {
          if (e.code !== 'P2002') {
            console.error(`Error: ${item.name}`, e.message?.slice(0, 50));
          }
          skipped++;
        }
      }
      
      // Delay between pages
      await new Promise(r => setTimeout(r, 200));
      
      if (items.length < 10) break; // No more pages
    }
    
    // Delay between queries
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`${category}: Added ${added}, Skipped ${skipped}`);
  return { added, skipped };
}

async function main() {
  console.log('Starting 2GIS import for Kazan...');
  console.log('API Key:', TWOGIS_API_KEY.slice(0, 8) + '...');
  
  const start = Date.now();
  let totalAdded = 0;
  let totalSkipped = 0;

  for (const [category, queries] of Object.entries(SEARCH_QUERIES)) {
    const result = await importCategory(category, queries, 2);
    totalAdded += result.added;
    totalSkipped += result.skipped;
  }

  const duration = ((Date.now() - start) / 1000 / 60).toFixed(1);
  
  console.log('\n=== Import Complete ===');
  console.log(`Total added: ${totalAdded}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Duration: ${duration} minutes`);
  
  // Show final stats
  const stats = await prisma.place.groupBy({
    by: ['category'],
    _count: { id: true },
  });
  
  console.log('\nBy category:');
  stats.forEach(s => console.log(`  ${s.category}: ${s._count.id}`));
  
  await prisma.$disconnect();
}

main().catch(console.error);
