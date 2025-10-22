import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getXeroTokens } from '@/lib/xero';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokens = await getXeroTokens(session.user.id);
    
    // Handle both single token and array of tokens
    const tokenArray = Array.isArray(tokens) ? tokens : (tokens ? [tokens] : []);
    
    if (tokenArray.length === 0) {
      return NextResponse.json({
        connected: false,
        totalConnections: 0,
        connections: [],
        message: 'No Xero connections found'
      });
    }

    const connections = tokenArray.map(token => ({
      tenantId: token.tenantId,
      connected: true,
      expiresAt: token.accessTokenExpiresAt.toISOString(),
      isExpired: token.accessTokenExpiresAt < new Date(),
      createdAt: token.createdAt.toISOString(),
      scope: token.scope
    }));

    return NextResponse.json({
      connected: true,
      totalConnections: connections.length,
      connections,
      message: 'Xero connections found'
    });

  } catch (error) {
    console.error('Xero status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Xero status' },
      { status: 500 }
    );
  }
}
