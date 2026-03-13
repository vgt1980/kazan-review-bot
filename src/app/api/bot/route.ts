import { NextRequest, NextResponse } from 'next/server';

// Webhook endpoint for Telegram
export async function POST(request: NextRequest) {
  const debug: string[] = [];
  
  try {
    debug.push('Starting bot import...');
    
    // Check environment
    debug.push(`BOT_TOKEN: ${process.env.BOT_TOKEN ? 'set' : 'missing'}`);
    debug.push(`TURSO_URL: ${process.env.TURSO_DATABASE_URL ? 'set' : 'missing'}`);
    debug.push(`TURSO_TOKEN: ${process.env.TURSO_AUTH_TOKEN ? 'set' : 'missing'}`);
    
    // Try to import bot
    let bot;
    try {
      const botModule = await import('../../../../bot');
      bot = botModule.default;
      debug.push('Bot imported successfully');
    } catch (importError) {
      const errMsg = importError instanceof Error ? importError.message : String(importError);
      debug.push(`Bot import failed: ${errMsg}`);
      return NextResponse.json({ 
        error: 'Bot import failed', 
        debug,
        details: errMsg 
      }, { status: 500 });
    }
    
    const body = await request.json();
    debug.push(`Received update: ${JSON.stringify(body).substring(0, 100)}...`);
    
    // Process the update
    await bot.handleUpdate(body);
    debug.push('Update processed successfully');
    
    return NextResponse.json({ ok: true, debug });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    debug.push(`Error: ${errorMessage}`);
    
    return NextResponse.json(
      { error: 'Internal server error', debug, details: errorMessage },
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
