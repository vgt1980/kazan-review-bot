import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [
      totalUsers,
      totalPlaces,
      totalReviews,
      pendingReviews,
      todayReviews,
      todayUsers,
    ] = await Promise.all([
      db.user.count(),
      db.place.count(),
      db.review.count({ where: { status: 'APPROVED' } }),
      db.review.count({ where: { status: 'PENDING' } }),
      db.review.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      db.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    return NextResponse.json({
      totalUsers,
      totalPlaces,
      totalReviews,
      pendingReviews,
      todayReviews,
      todayUsers,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
