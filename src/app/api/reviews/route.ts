import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List reviews
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('placeId');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'APPROVED';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    if (placeId) {
      where.placeId = placeId;
    }
    if (userId) {
      where.userId = userId;
    }
    if (status) {
      where.status = status;
    }

    const reviews = await db.review.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: [
        { upvotes: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        user: {
          select: {
            username: true,
            firstName: true,
          },
        },
        place: {
          select: {
            name: true,
            category: true,
          },
        },
      },
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

// POST - Create review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      placeId,
      telegramId,
      overallRating,
      foodRating,
      serviceRating,
      atmosphereRating,
      valueRating,
      text,
    } = body;

    if (!placeId || !telegramId || !overallRating || !text) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get or create user
    let user = await db.user.findUnique({
      where: { telegramId: telegramId.toString() },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          telegramId: telegramId.toString(),
        },
      });
    }

    // Check for existing review
    const existing = await db.review.findUnique({
      where: {
        placeId_userId: { placeId, userId: user.id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Вы уже оставляли отзыв об этом заведении' },
        { status: 400 }
      );
    }

    // Create review
    const review = await db.review.create({
      data: {
        placeId,
        userId: user.id,
        overallRating,
        foodRating,
        serviceRating,
        atmosphereRating,
        valueRating,
        text,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ 
      success: true, 
      review,
      message: 'Отзыв отправлен на модерацию' 
    });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
}
