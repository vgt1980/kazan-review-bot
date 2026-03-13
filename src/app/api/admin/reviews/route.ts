import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List reviews
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          place: {
            select: { name: true, category: true },
          },
          user: {
            select: { username: true, telegramId: true },
          },
        },
      }),
      db.review.count({ where }),
    ]);

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

// PATCH - Update review status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, status, rejectionReason } = body;

    if (!reviewId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const review = await db.review.update({
      where: { id: reviewId },
      data: {
        status,
        rejectionReason,
        moderatedAt: new Date(),
      },
    });

    // If approved, update place stats
    if (status === 'APPROVED') {
      await updatePlaceStats(review.placeId);
    }

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error('Error updating review:', error);
    return NextResponse.json(
      { error: 'Failed to update review' },
      { status: 500 }
    );
  }
}

// Helper function to update place statistics
async function updatePlaceStats(placeId: string) {
  const reviews = await db.review.findMany({
    where: { placeId, status: 'APPROVED' },
    select: {
      overallRating: true,
      foodRating: true,
      serviceRating: true,
      atmosphereRating: true,
      valueRating: true,
    },
  });

  if (reviews.length === 0) return;

  const avgOverall = reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length;
  
  const foodRatings = reviews.filter(r => r.foodRating);
  const serviceRatings = reviews.filter(r => r.serviceRating);
  const atmosphereRatings = reviews.filter(r => r.atmosphereRating);
  const valueRatings = reviews.filter(r => r.valueRating);

  await db.place.update({
    where: { id: placeId },
    data: {
      rating: avgOverall,
      reviewCount: reviews.length,
      avgFood: foodRatings.length > 0 
        ? foodRatings.reduce((sum, r) => sum + (r.foodRating || 0), 0) / foodRatings.length 
        : 0,
      avgService: serviceRatings.length > 0 
        ? serviceRatings.reduce((sum, r) => sum + (r.serviceRating || 0), 0) / serviceRatings.length 
        : 0,
      avgAtmosphere: atmosphereRatings.length > 0 
        ? atmosphereRatings.reduce((sum, r) => sum + (r.atmosphereRating || 0), 0) / atmosphereRatings.length 
        : 0,
      avgValue: valueRatings.length > 0 
        ? valueRatings.reduce((sum, r) => sum + (r.valueRating || 0), 0) / valueRatings.length 
        : 0,
    },
  });
}
