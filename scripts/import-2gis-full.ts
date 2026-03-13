/**
 * 2GIS Full Import - More queries, more pages
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_KEY = '629f0d11-ac03-44b8-893b-c772f057c68f';

// Expanded queries
const QUERIES = [
  // Restaurants & Food
  'ресторан', 'итальянский ресторан', 'японский ресторан', 'грузинский ресторан',
  'кафе', 'кофейня', 'пекарня', 'кондитерская', 'чайная',
  'бар', 'паб', 'винотека', 'спикизи',
  'пицца', 'суши', 'бургер', 'шаурма',
  'стейкхаус', 'гриль', 'чахохбили',
  
  // Beauty
  'салон красоты', 'барбершоп', 'парикмахерская',
  'ногтевая студия', 'маникюр', 'педикюр',
  'косметолог', 'визажист', 'брови',
  'спа салон', 'массаж', 'эпиляция',
  
  // Fitness & Sport
  'фитнес клуб', 'спортзал', 'тренажерный зал',
  'бассейн', 'йога', 'пилатес', 'танцы',
  'кроссфит', 'единоборства', 'бокс',
  
  // Auto
  'автомойка', 'мойка самообслуживания',
  'автосервис', 'сто', 'шиномонтаж',
  'автоэлектрик', 'диагностика авто',
  
  // Hotels
  'отель', 'гостиница', 'хостел', 'апарт-отель',
  
  // Health
  'стоматология', 'зубная клиника', 'ортодонт',
  'аптека', 'медцентр', 'поликлиника',
  
  // Services
  'химчистка', 'прачечная', 'ателье',
  'ремонт телефонов', 'ремонт компьютеров',
];

interface Place {
  id: string;
  name: string;
  address_name?: string;
  point?: { lat: number; lon: number };
  rubrics?: { name: string }[];
}

async function search(query: string, page: number): Promise<Place[]> {
  const url = `https://catalog.api.2gis.ru/3.0/items?q=${encodeURIComponent(query)}%20Казань&page_size=10&page=${page}&key=${API_KEY}&fields=items.point,items.rubrics`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.result?.items || [];
  } catch {
    return [];
  }
}

function getCategory(rubrics: string[]): string {
  const text = (rubrics || []).join(' ').toLowerCase();
  
  if (text.includes('ресторан') || text.includes('стейкхаус') || text.includes('гриль')) return 'RESTAURANT';
  if (text.includes('кафе')) return 'CAFE';
  if (text.includes('бар') || text.includes('паб') || text.includes('винотек')) return 'BAR';
  if (text.includes('кофейня') || text.includes('пекарня') || text.includes('кондитерск')) return 'CAFE';
  if (text.includes('пицца') || text.includes('суши') || text.includes('бургер')) return 'RESTAURANT';
  if (text.includes('шаурма') || text.includes('фастфуд')) return 'RESTAURANT';
  if (text.includes('салон красоты') || text.includes('парикмахерская')) return 'BEAUTY';
  if (text.includes('барбершоп')) return 'BEAUTY';
  if (text.includes('ногт') || text.includes('маникюр') || text.includes('педикюр')) return 'BEAUTY';
  if (text.includes('массаж') || text.includes('спа') || text.includes('эпиляц')) return 'BEAUTY';
  if (text.includes('косметолог') || text.includes('визаж') || text.includes('брови')) return 'BEAUTY';
  if (text.includes('фитнес') || text.includes('спортзал') || text.includes('тренажер')) return 'FITNESS';
  if (text.includes('бассейн')) return 'FITNESS';
  if (text.includes('йога') || text.includes('пилатес') || text.includes('танц')) return 'FITNESS';
  if (text.includes('кроссфит') || text.includes('бокс') || text.includes('единоборств')) return 'FITNESS';
  if (text.includes('отель') || text.includes('гостиница') || text.includes('хостел')) return 'HOTEL';
  if (text.includes('аптек')) return 'HEALTH';
  if (text.includes('стоматолог') || text.includes('зубн') || text.includes('ортодонт')) return 'HEALTH';
  if (text.includes('медцентр') || text.includes('поликлиник') || text.includes('клиник')) return 'HEALTH';
  if (text.includes('автосервис') || text.includes('сто') || text.includes('автомастерск')) return 'SERVICE';
  if (text.includes('автомойка') || text.includes('мойка')) return 'SERVICE';
  if (text.includes('шиномонтаж') || text.includes('автоэлектрик')) return 'SERVICE';
  if (text.includes('химчистк') || text.includes('прачечн') || text.includes('ателье')) return 'SERVICE';
  if (text.includes('ремонт')) return 'SERVICE';
  
  return 'OTHER';
}

function getDistrict(address: string): string {
  if (!address) return 'Вахитовский';
  
  const a = address.toLowerCase();
  if (a.includes('авиастроительн')) return 'Авиастроительный';
  if (a.includes('вахитовск')) return 'Вахитовский';
  if (a.includes('кировск')) return 'Кировский';
  if (a.includes('московск')) return 'Московский';
  if (a.includes('ново-савиновск')) return 'Ново-Савиновский';
  if (a.includes('приволжск')) return 'Приволжский';
  if (a.includes('советск')) return 'Советский';
  
  // Street-based
  if (a.includes('баумана') || a.includes('университетск') || a.includes('пушкина')) return 'Вахитовский';
  if (a.includes('победы') || a.includes('фучика') || a.includes('даурск')) return 'Приволжский';
  if (a.includes('ямашева') || a.includes('декабрист') || a.includes('ленинск')) return 'Московский';
  if (a.includes('чуйкова') || a.includes('линдора') || a.includes('абжалилов')) return 'Ново-Савиновский';
  if (a.includes('ибирси') || a.includes('танк')) return 'Авиастроительный';
  
  return 'Вахитовский';
}

async function main() {
  console.log('2GIS Full Import\n');
  
  let added = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const query of QUERIES) {
    process.stdout.write(query.padEnd(25));
    let found = 0;
    
    for (let page = 1; page <= 2; page++) {
      const items = await search(query, page);
      if (!items.length) break;
      
      for (const item of items) {
        const key = item.name.toLowerCase().trim();
        
        if (seen.has(key)) { skipped++; continue; }
        seen.add(key);
        
        try {
          await prisma.place.create({
            data: {
              name: item.name,
              category: getCategory(item.rubrics?.map(r => r.name) || []) as any,
              district: getDistrict(item.address_name || ''),
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
      
      await new Promise(r => setTimeout(r, 200));
      if (items.length < 10) break;
    }
    
    console.log(`+${found}`);
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\nAdded: ${added}, Skipped: ${skipped}`);
  
  const total = await prisma.place.count();
  console.log(`Total: ${total}`);
  
  const stats = await prisma.place.groupBy({
    by: ['category'],
    _count: { id: true },
  });
  
  console.log('\nBy category:');
  stats.sort((a, b) => b._count.id - a._count.id).forEach(s => 
    console.log(`  ${s.category}: ${s._count.id}`)
  );
  
  await prisma.$disconnect();
}

main();
