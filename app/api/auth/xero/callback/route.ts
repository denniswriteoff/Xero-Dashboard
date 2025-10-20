import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createXeroClient, saveXeroTokens } from '@/lib/xero';
import { prisma } from '@/util/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('Xero OAuth error:', error);
    console.log('Xero OAuth code:', code);
    console.log('Xero OAuth state:', state);
    console.log('Xero OAuth session:', session);
    console.log('Xero OAuth request:', request);
    console.log('Xero OAuth searchParams:', searchParams);
    console.log('Xero OAuth request.url:', request.url);
    console.log('Xero OAuth request.nextUrl:', request.nextUrl);

    if (error) {
      console.error('Xero OAuth error:', error);
      return NextResponse.redirect(new URL('/?error=xero_auth_failed', request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/?error=missing_code', request.url));
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.redirect(new URL('/?error=user_not_found', request.url));
    }

    // Exchange code for tokens
    const xero = createXeroClient();
    await xero.initialize();
    const tokenSet = await xero.apiCallback(request.url);
    
    if (!tokenSet.access_token || !tokenSet.refresh_token) {
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
    }

    // Get tenant connections
    const connections = await xero.updateTenants(true);
    
    if (!connections || connections.length === 0) {
      return NextResponse.redirect(new URL('/?error=no_tenants_found', request.url));
    }

    // Save tokens for the first (primary) tenant only - single organization restriction
    const primaryConnection = connections[0];
    if (primaryConnection && primaryConnection.tenantId) {
      await saveXeroTokens(user.id, {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        idToken: tokenSet.id_token,
        expiresIn: tokenSet.expires_in || 1800,
        tokenType: tokenSet.token_type || 'Bearer',
        scope: tokenSet.scope,
        tenantId: primaryConnection.tenantId
      });
    } else {
      return NextResponse.redirect(new URL('/?error=no_primary_tenant', request.url));
    }

    return NextResponse.redirect(new URL('/?success=xero_connected', request.url));
  } catch (error) {
    console.error('Xero callback error:', error);
    return NextResponse.redirect(new URL('/?error=callback_failed', request.url));
  }
}