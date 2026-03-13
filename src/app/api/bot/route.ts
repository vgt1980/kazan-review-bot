import { NextRequest, NextResponse } from 'next/server';
import bot from '../../../../bot';

// Webhook endpoint for Telegram
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Process the update
    await bot.handleUpdate(body);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get webhook info
export async function GET() {
  return NextResponse.json({
    status: 'Telegram bot webhook endpoint',
    info: 'Use POST to receive updates from Telegram',
  });
}
