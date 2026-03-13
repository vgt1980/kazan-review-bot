import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List places
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

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

    const [places, total] = await Promise.all([
      db.place.findMany({
        where,
        skip,
        take: limit,
        orderBy: { rating: 'desc' },
      }),
      db.place.count({ where }),
    ]);

    return NextResponse.json({
      places,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching places:', error);
    return NextResponse.json(
      { error: 'Failed to fetch places' },
      { status: 500 }
    );
  }
}

// POST - Create place
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, district, address, latitude, longitude, description } = body;

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const place = await db.place.create({
      data: {
        name,
        category,
        district,
        address,
        latitude,
        longitude,
        description,
      },
    });

    return NextResponse.json({ success: true, place });
  } catch (error) {
    console.error('Error creating place:', error);
    return NextResponse.json(
      { error: 'Failed to create place' },
      { status: 500 }
    );
  }
}

// PATCH - Update place
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { placeId, ...data } = body;

    if (!placeId) {
      return NextResponse.json(
        { error: 'Missing place ID' },
        { status: 400 }
      );
    }

    const place = await db.place.update({
      where: { id: placeId },
      data,
    });

    return NextResponse.json({ success: true, place });
  } catch (error) {
    console.error('Error updating place:', error);
    return NextResponse.json(
      { error: 'Failed to update place' },
      { status: 500 }
    );
  }
}

// DELETE - Delete place
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('id');

    if (!placeId) {
      return NextResponse.json(
        { error: 'Missing place ID' },
        { status: 400 }
      );
    }

    await db.place.delete({
      where: { id: placeId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting place:', error);
    return NextResponse.json(
      { error: 'Failed to delete place' },
      { status: 500 }
    );
  }
}
