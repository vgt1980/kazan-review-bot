import { NextRequest, NextResponse } from 'next/server';

// Cache for bot initialization
let botInitPromise: Promise<void> | null = null;

// Webhook endpoint for Telegram
export async function POST(request: NextRequest) {
  try {
    // Import bot module
    const botModule = await import('../../../../bot');
    const bot = botModule.default;
    const initBot = botModule.initBot;
    
    // Initialize bot once (cached)
    if (initBot) {
      if (!botInitPromise) {
        botInitPromise = initBot();
      }
      await botInitPromise;
    }
    
    const body = await request.json();
    
    // Process the update
    await bot.handleUpdate(body);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Webhook error:', {
      message: errorMessage,
      stack: errorStack?.split('\n').slice(0, 5).join('\n'),
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
    env: {
      hasBotToken: !!process.env.BOT_TOKEN,
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
      hasWebappUrl: !!process.env.WEBAPP_URL,
    }
  });
}
