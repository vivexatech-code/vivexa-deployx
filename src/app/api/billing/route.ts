import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'billing',
    endpoints: ['/config', '/plans', '/create-order', '/verify-payment', '/cancel-subscription'],
  });
}
