import { NextRequest, NextResponse } from 'next/server';

// Webhook endpoint for Telegram
export async function POST(request: NextRequest) {
  try {
    // Dynamic import to catch initialization errors
    const { default: bot } = await import('../../../../bot');
    
    const body = await request.json();
    
    // Process the update
    await bot.handleUpdate(body);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Return detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      env: {
        hasBotToken: !!process.env.BOT_TOKEN,
        hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
        hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
        nodeEnv: process.env.NODE_ENV,
      }
    });
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

// Get webhook info
export async function GET() {
  return NextResponse.json({
    status: 'Telegram bot webhook endpoint',
    info: 'Use POST to receive updates from Telegram',
    env: {
      hasBotToken: !!process.env.BOT_TOKEN,
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
    }
  });
}
