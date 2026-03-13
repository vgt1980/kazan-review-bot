import { NextRequest, NextResponse } from 'next/server';

// Webhook endpoint for Telegram
export async function POST(request: NextRequest) {
  try {
    // Import bot and init function
    const { default: bot, initBot } = await import('../../../../bot');
    
    // Initialize bot for webhook mode (required by grammY)
    await initBot();
    
    const body = await request.json();
    
    // Process the update
    await bot.handleUpdate(body);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    
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
