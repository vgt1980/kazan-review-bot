/**
 * 2GIS Import for Kazan places
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_KEY = '629f0d11-ac03-44b8-893b-c772f057c68f';

const QUERIES = [
  'ресторан', 'кафе', 'бар', 'паб', 'кофейня', 'пекарня',
  'салон красоты', 'барбершоп', 'парикмахерская', 'ногтевая',
  'фитнес', 'спортзал', 'бассейн', 'йога',
  'автомойка', 'автосервис', 'шиномонтаж',
  'отель', 'гостиница', 'хостел',
  'стоматология', 'аптека', 'медцентр',
];

interface Place {
  id: string;
  name: string;
  address_name?: string;
  point?: { lat: number; lon: number };
  rubrics?: { name: string }[];
}

async function search(query: string): Promise<Place[]> {
  const url = `https://catalog.api.2gis.ru/3.0/items?q=${encodeURIComponent(query)}%20Казань&page_size=10&key=${API_KEY}&fields=items.point,items.rubrics`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  return data.result?.items || [];
}

function getCategory(rubrics: string[]): string {
  const text = (rubrics || []).join(' ').toLowerCase();
  
  if (text.includes('ресторан')) return 'RESTAURANT';
  if (text.includes('кафе')) return 'CAFE';
  if (text.includes('бар') || text.includes('паб')) return 'BAR';
  if (text.includes('кофейня') || text.includes('пекарня')) return 'CAFE';
  if (text.includes('салон') || text.includes('парикмахер') || text.includes('барбершоп')) return 'BEAUTY';
  if (text.includes('ногт') || text.includes('маникюр')) return 'BEAUTY';
  if (text.includes('фитнес') || text.includes('спортзал') || text.includes('тренажер')) return 'FITNESS';
  if (text.includes('бассейн')) return 'FITNESS';
  if (text.includes('йога') || text.includes('пилатес')) return 'FITNESS';
  if (text.includes('отель') || text.includes('гостиница') || text.includes('хостел')) return 'HOTEL';
  if (text.includes('автосервис') || text.includes('сто') || text.includes('автомастерск')) return 'SERVICE';
  if (text.includes('автомойка') || text.includes('мойка')) return 'SERVICE';
  if (text.includes('аптек')) return 'HEALTH';
  if (text.includes('стоматолог') || text.includes('зубн') || text.includes('медцентр')) return 'HEALTH';
  
  return 'OTHER';
}

async function main() {
  console.log('2GIS Import Starting...\n');
  
  let added = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const query of QUERIES) {
    process.stdout.write(query.padEnd(20));
    
    const items = await search(query);
    let found = 0;
    
    for (const item of items) {
      const key = item.name.toLowerCase().trim();
      
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      
      try {
        await prisma.place.create({
          data: {
            name: item.name,
            category: getCategory(item.rubrics?.map(r => r.name) || []) as any,
            district: 'Вахитовский',
            address: item.address_name,
            latitude: item.point?.lat,
            longitude: item.point?.lon,
          }
        });
        added++;
        found++;
      } catch {
        skipped++;
      }
    }
    
    console.log(` +${found}`);
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nAdded: ${added}, Skipped: ${skipped}`);
  
  const total = await prisma.place.count();
  console.log(`Total in DB: ${total}`);
  
  const stats = await prisma.place.groupBy({
    by: ['category'],
    _count: { id: true },
  });
  
  console.log('\nBy category:');
  stats.forEach(s => console.log(`  ${s.category}: ${s._count.id}`));
  
  await prisma.$disconnect();
}

main();
