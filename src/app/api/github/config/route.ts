import { NextResponse } from 'next/server';

export async function GET() {
  const isConfigured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  return NextResponse.json({
    configured: isConfigured,
    clientId: process.env.GITHUB_CLIENT_ID || null,
  });
}
