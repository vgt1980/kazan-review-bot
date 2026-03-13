/**
 * 2GIS Import with debug
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_KEY = '629f0d11-ac03-44b8-893b-c772f057c68f';

async function main() {
  console.log('Testing database connection...\n');
  
  // Try to create a simple place
  try {
    const place = await prisma.place.create({
      data: {
        name: 'Test Restaurant',
        category: 'RESTAURANT',
        district: 'Вахитовский',
        address: 'Test Address 1',
      }
    });
    console.log('Created place:', place);
    
    // Delete it
    await prisma.place.delete({ where: { id: place.id } });
    console.log('Deleted test place');
    
  } catch (e: any) {
    console.error('Database error:', e.message);
    console.error('Full error:', JSON.stringify(e, null, 2));
  }
  
  await prisma.$disconnect();
}

main();
