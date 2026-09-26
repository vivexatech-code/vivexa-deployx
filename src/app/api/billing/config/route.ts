import { NextResponse } from 'next/server';
import { RazorpayService } from '@/lib/razorpay/razorpayService';
import { GST_RATE } from '@/lib/plans/plansData';

export async function GET() {
  return NextResponse.json({
    keyId: process.env.RAZORPAY_KEY_ID || '',
    configured: RazorpayService.isConfigured(),
    currency: 'INR',
    gstRate: GST_RATE,
  });
}
