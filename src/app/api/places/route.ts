import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List places
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};
    if (category) {
      where.category = category;
    }
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const places = await db.place.findMany({
      where,
      take: limit,
      orderBy: [
        { reviewCount: 'desc' },
        { rating: 'desc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ places });
  } catch (error) {
    console.error('Error fetching places:', error);
    return NextResponse.json(
      { error: 'Failed to fetch places' },
      { status: 500 }
    );
  }
}
