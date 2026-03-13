/**
 * 2GIS Full Import to Turso Database
 */

import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

// Use Turso credentials directly
const TURSO_URL = 'libsql://database-rose-basket-vercel-icfg-yhqbyqayyhci4wpxiczke8ih.aws-us-east-1.turso.io'
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzMyNDc0NDksImlkIjoiMDE5Y2RkYzgtYzgwMS03YTYyLWI5ZTUtMjVhOGNkODMyZThlIiwicmlkIjoiNjJlMTRhNWYtODg0Mi00OTU5LTg2NWQtZTA2M2VlMjcyOTBkIn0.igICatIPP8O9oRUvaBa742KGnE-Rv3ibfp16hWzDa1LQqnUY3gyeYaP3_QubwvJML0SO8qyxaLY3MnYh1cFPBg'

const adapter = new PrismaLibSql({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
})

const prisma = new PrismaClient({ adapter })

const API_KEY = '629f0d11-ac03-44b8-893b-c772f057c68f'

const QUERIES = [
  'ресторан', 'итальянский ресторан', 'японский ресторан', 'грузинский ресторан',
  'кафе', 'кофейня', 'пекарня', 'кондитерская', 'чайная',
  'бар', 'паб', 'винотека', 'спикизи',
  'пицца', 'суши', 'бургер', 'шаурма',
  'салон красоты', 'барбершоп', 'парикмахерская',
  'ногтевая', 'маникюр', 'косметолог', 'спа', 'массаж',
  'фитнес', 'спортзал', 'бассейн', 'йога', 'танцы',
  'автомойка', 'автосервис', 'шиномонтаж',
  'отель', 'гостиница', 'хостел',
  'стоматология', 'аптека', 'медцентр',
]

interface Place {
  id: string
  name: string
  address_name?: string
  point?: { lat: number; lon: number }
  rubrics?: { name: string }[]
}

async function search(query: string, page: number): Promise<Place[]> {
  const url = `https://catalog.api.2gis.ru/3.0/items?q=${encodeURIComponent(query)}%20Казань&page_size=10&page=${page}&key=${API_KEY}&fields=items.point,items.rubrics`
  
  try {
    const res = await fetch(url)
    const data = await res.json()
    return data.result?.items || []
  } catch {
    return []
  }
}

function getCategory(rubrics: string[]): string {
  const t = (rubrics || []).join(' ').toLowerCase()
  
  if (t.includes('ресторан') || t.includes('гриль') || t.includes('стейк')) return 'RESTAURANT'
  if (t.includes('кафе') || t.includes('кофейня') || t.includes('пекарня')) return 'CAFE'
  if (t.includes('бар') || t.includes('паб') || t.includes('винотек')) return 'BAR'
  if (t.includes('пицца') || t.includes('суши') || t.includes('бургер')) return 'FAST_FOOD'
  if (t.includes('салон') || t.includes('парикмахер') || t.includes('барбершоп')) return 'BEAUTY'
  if (t.includes('ногт') || t.includes('маникюр') || t.includes('косметолог') || t.includes('массаж')) return 'BEAUTY'
  if (t.includes('фитнес') || t.includes('спортзал') || t.includes('бассейн')) return 'FITNESS'
  if (t.includes('йога') || t.includes('танц') || t.includes('пилатес')) return 'FITNESS'
  if (t.includes('отель') || t.includes('гостиница') || t.includes('хостел')) return 'HOTEL'
  if (t.includes('аптек')) return 'HEALTH'
  if (t.includes('стоматолог') || t.includes('медцентр')) return 'HEALTH'
  if (t.includes('автомойк') || t.includes('автосервис') || t.includes('шиномонтаж')) return 'SERVICE'
  
  return 'OTHER'
}

function getDistrict(address: string): string {
  if (!address) return 'Вахитовский'
  
  const a = address.toLowerCase()
  if (a.includes('авиастроительн')) return 'Авиастроительный'
  if (a.includes('кировск')) return 'Кировский'
  if (a.includes('московск')) return 'Московский'
  if (a.includes('ново-савиновск')) return 'Ново-Савиновский'
  if (a.includes('приволжск')) return 'Приволжский'
  if (a.includes('советск')) return 'Советский'
  if (a.includes('ямашева') || a.includes('декабрист')) return 'Московский'
  if (a.includes('баумана') || a.includes('пушкина')) return 'Вахитовский'
  if (a.includes('победы') || a.includes('фучика')) return 'Приволжский'
  
  return 'Вахитовский'
}

async function main() {
  console.log('2GIS Import to Turso\n')
  
  let added = 0
  let skipped = 0
  const seen = new Set<string>()

  for (const query of QUERIES) {
    process.stdout.write(query.padEnd(22))
    let found = 0
    
    for (let page = 1; page <= 2; page++) {
      const items = await search(query, page)
      if (!items.length) break
      
      for (const item of items) {
        const key = item.name.toLowerCase().trim()
        
        if (seen.has(key)) { skipped++; continue }
        seen.add(key)
        
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
          })
          added++
          found++
        } catch {
          skipped++
        }
      }
      
      if (items.length < 10) break
      await new Promise(r => setTimeout(r, 200))
    }
    
    console.log(`+${found}`)
    await new Promise(r => setTimeout(r, 250))
  }

  console.log(`\nAdded: ${added}, Skipped: ${skipped}`)
  
  const total = await prisma.place.count()
  console.log(`Total: ${total}`)
  
  const stats = await prisma.place.groupBy({
    by: ['category'],
    _count: { id: true },
  })
  
  console.log('\nBy category:')
  stats.sort((a, b) => b._count.id - a._count.id).forEach(s => 
    console.log(`  ${s.category}: ${s._count.id}`)
  )
  
  await prisma.$disconnect()
}

main().catch(console.error)
