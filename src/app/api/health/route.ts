import { NextResponse } from 'next/server';
import { VercelService } from '@/lib/vercel/vercelService';
import { RazorpayService } from '@/lib/razorpay/razorpayService';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    githubOAuthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    vercelConfigured: VercelService.isConfigured(),
    razorpayConfigured: RazorpayService.isConfigured(),
  });
}
