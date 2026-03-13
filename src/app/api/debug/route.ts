import { NextResponse } from 'next/server';

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  // Check if URL has trailing newline
  const urlCheck = {
    length: tursoUrl?.length || 0,
    hasNewline: tursoUrl?.includes('\n') || false,
    trimmed: tursoUrl?.trim() === tursoUrl,
    preview: tursoUrl?.substring(0, 50) + '...',
  };

  return NextResponse.json({
    tursoUrl: urlCheck,
    hasToken: !!tursoToken,
    tokenLength: tursoToken?.length || 0,
  });
}
