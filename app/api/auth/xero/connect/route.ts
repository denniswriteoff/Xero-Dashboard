import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getXeroAuthUrl } from '@/lib/xero';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a state parameter for security
    const state = `${session.user.email}_${Date.now()}`;
    const authUrl = await getXeroAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Xero connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Xero authentication' },
      { status: 500 }
    );
  }
}