import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revokeXeroToken } from '@/lib/xero';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = await request.json();
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    await revokeXeroToken(session.user.id, tenantId);

    return NextResponse.json({
      success: true,
      message: 'Xero connection revoked successfully'
    });

  } catch (error) {
    console.error('Xero revoke error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke Xero connection' },
      { status: 500 }
    );
  }
}
