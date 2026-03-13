import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Category } from '@prisma/client';

// Admin IDs
const ADMIN_IDS = ['1892592914'];

// GET - Get all places or search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category') as Category | null;
    const district = searchParams.get('district');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (district) {
      where.district = district;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [places, total] = await Promise.all([
      db.place.findMany({
        where,
        orderBy: [
          { reviewCount: 'desc' },
          { rating: 'desc' },
          { name: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      db.place.count({ where }),
    ]);

    return NextResponse.json({ places, total });
  } catch (error) {
    console.error('Error fetching places:', error);
    return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
  }
}

// POST - Create new place
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telegramId, place } = body;

    // Verify admin
    const envAdminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim()).filter(id => id);
    const allAdminIds = [...new Set([...ADMIN_IDS, ...envAdminIds])];
    
    if (!telegramId || !allAdminIds.includes(String(telegramId).trim())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!place?.name || !place?.category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 });
    }

    // Check for duplicates
    const existing = await db.place.findFirst({
      where: {
        name: { equals: place.name, mode: 'insensitive' },
        category: place.category as Category,
      },
    });

    if (existing) {
      return NextResponse.json({ 
        error: 'Заведение с таким названием уже существует в этой категории',
        existingPlace: existing 
      }, { status: 400 });
    }

    const newPlace = await db.place.create({
      data: {
        name: place.name.trim(),
        category: place.category as Category,
        district: place.district?.trim() || null,
        address: place.address?.trim() || null,
        latitude: place.latitude ? parseFloat(place.latitude) : null,
        longitude: place.longitude ? parseFloat(place.longitude) : null,
        description: place.description?.trim() || null,
        rating: 0,
        reviewCount: 0,
      },
    });

    return NextResponse.json({ success: true, place: newPlace });
  } catch (error) {
    console.error('Error creating place:', error);
    return NextResponse.json({ error: 'Failed to create place' }, { status: 500 });
  }
}

// PUT - Update place
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { telegramId, placeId, updates } = body;

    // Verify admin
    const envAdminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim()).filter(id => id);
    const allAdminIds = [...new Set([...ADMIN_IDS, ...envAdminIds])];
    
    if (!telegramId || !allAdminIds.includes(String(telegramId).trim())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!placeId) {
      return NextResponse.json({ error: 'Place ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    
    if (updates.name) updateData.name = updates.name.trim();
    if (updates.category) updateData.category = updates.category;
    if (updates.district !== undefined) updateData.district = updates.district?.trim() || null;
    if (updates.address !== undefined) updateData.address = updates.address?.trim() || null;
    if (updates.latitude) updateData.latitude = parseFloat(updates.latitude);
    if (updates.longitude) updateData.longitude = parseFloat(updates.longitude);
    if (updates.description !== undefined) updateData.description = updates.description?.trim() || null;

    const updatedPlace = await db.place.update({
      where: { id: placeId },
      data: updateData,
    });

    return NextResponse.json({ success: true, place: updatedPlace });
  } catch (error) {
    console.error('Error updating place:', error);
    return NextResponse.json({ error: 'Failed to update place' }, { status: 500 });
  }
}

// DELETE - Delete place
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('placeId');
    const telegramId = searchParams.get('telegramId');

    // Verify admin
    const envAdminIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim()).filter(id => id);
    const allAdminIds = [...new Set([...ADMIN_IDS, ...envAdminIds])];
    
    if (!telegramId || !allAdminIds.includes(String(telegramId).trim())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!placeId) {
      return NextResponse.json({ error: 'Place ID is required' }, { status: 400 });
    }

    // Delete related reviews first
    await db.review.deleteMany({ where: { placeId } });

    // Delete the place
    await db.place.delete({ where: { id: placeId } });

    return NextResponse.json({ success: true, message: 'Place deleted' });
  } catch (error) {
    console.error('Error deleting place:', error);
    return NextResponse.json({ error: 'Failed to delete place' }, { status: 500 });
  }
}
