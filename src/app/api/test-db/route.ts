import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Check env vars
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    // Test connection
    const placesCount = await db.place.count();

    return NextResponse.json({
      success: true,
      placesCount,
      tursoUrl: tursoUrl ? tursoUrl.substring(0, 50) + '...' : 'NOT SET',
      tursoTokenLength: tursoToken?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error',
      tursoUrl: process.env.TURSO_DATABASE_URL ? 'SET' : 'NOT SET',
      tursoToken: process.env.TURSO_AUTH_TOKEN ? 'SET' : 'NOT SET',
    }, { status: 500 });
  }
}
