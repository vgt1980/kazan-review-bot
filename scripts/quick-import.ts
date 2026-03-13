import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({
  url: 'libsql://database-rose-basket-vercel-icfg-yhqbyqayyhci4wpxiczke8ih.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzMyNDc0NDksImlkIjoiMDE5Y2RkYzgtYzgwMS03YTYyLWI5ZTUtMjVhOGNkODMyZThlIiwicmlkIjoiNjJlMTRhNWYtODg0Mi00OTU5LTg2NWQtZTA2M2VlMjcyOTBkIn0.igICatIPP8O9oRUvaBa742KGnE-Rv3ibfp16hWzDa1LQqnUY3gyeYaP3_QubwvJML0SO8qyxaLY3MnYh1cFPBg',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Testing Turso connection...')
  
  const count = await prisma.place.count()
  console.log('Current places:', count)
  
  // Add some test places
  const places = [
    { name: 'Frank by Баста', category: 'RESTAURANT', address: 'Петербургская ул., 9а' },
    { name: 'Супра Кино', category: 'RESTAURANT', address: 'ул. Баумана, 58а' },
    { name: 'Горыныч', category: 'RESTAURANT', address: 'ул. Николая Ершова, 62' },
    { name: 'Цех', category: 'RESTAURANT', address: 'ул. Каюма Насыри, 3' },
    { name: 'Dom Chaya', category: 'CAFE', address: 'ул. Баумана' },
  ]
  
  for (const p of places) {
    try {
      await prisma.place.create({ data: { ...p, district: 'Вахитовский' } })
      console.log('Added:', p.name)
    } catch (e) {
      console.log('Skip:', p.name)
    }
  }
  
  const final = await prisma.place.count()
  console.log('Total:', final)
  
  await prisma.$disconnect()
}

main()
