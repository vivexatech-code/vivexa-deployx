import { NextResponse } from 'next/server';
import { getAllPlansFromFirebase } from '@/lib/plans/plansData';

export async function GET() {
  try {
    const plans = await getAllPlansFromFirebase();
    return NextResponse.json({ plans });
  } catch (err: any) {
    console.error('Error fetching plans in billing plans route:', err);
    return NextResponse.json({ error: 'Failed to retrieve plans from database.' }, { status: 500 });
  }
}
