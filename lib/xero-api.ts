import { XeroClient } from 'xero-node';
import { getXeroTokens, refreshXeroToken, createXeroClient } from './xero';

/**
 * Creates an authenticated Xero API client for a specific user and tenant
 */
export async function getXeroApiClient(userId: string, tenantId: string): Promise<XeroClient | null> {
  try {
    const tokenRecord = await getXeroTokens(userId, tenantId);
    
    if (!tokenRecord || Array.isArray(tokenRecord)) {
      console.error('No Xero token found for user and tenant');
      return null;
    }

    // Check if token is expired and refresh if needed
    if (tokenRecord.accessTokenExpiresAt < new Date()) {
      try {
        await refreshXeroToken(userId, tenantId);
        // Get the refreshed token
        const refreshedToken = await getXeroTokens(userId, tenantId);
        if (!refreshedToken || Array.isArray(refreshedToken)) {
          console.error('Failed to get refreshed token');
          return null;
        }
        tokenRecord.accessToken = refreshedToken.accessToken;
        tokenRecord.refreshToken = refreshedToken.refreshToken;
        tokenRecord.expiresIn = refreshedToken.expiresIn;
        tokenRecord.tokenType = refreshedToken.tokenType;
        tokenRecord.scope = refreshedToken.scope;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        return null;
      }
    }

    const xero = createXeroClient();
    await xero.initialize();

    // Set the token set for the API client
    xero.setTokenSet({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
      expires_in: tokenRecord.expiresIn,
      token_type: tokenRecord.tokenType,
      scope: tokenRecord.scope || undefined
    });

    return xero;
  } catch (error) {
    console.error('Error creating Xero API client:', error);
    return null;
  }
}

/**
 * Get organization information
 */
export async function getOrganisation(userId: string, tenantId: string) {
  const xero = await getXeroApiClient(userId, tenantId);
  if (!xero) {
    throw new Error('Failed to create Xero API client');
  }

  try {
    const response = await xero.accountingApi.getOrganisations(tenantId);
    return response.body.organisations?.[0] || null;
  } catch (error) {
    console.error('Error fetching organisation:', error);
    throw error;
  }
}

/**
 * Get Profit and Loss report from Xero
 */
export async function getProfitAndLossReport(userId: string, tenantId: string, options?: {
  fromDate?: string;
  toDate?: string;
  periods?: number;
  timeframe?: string;
  trackingCategoryID?: string;
  trackingCategoryID2?: string;
  trackingOptionID?: string;
  trackingOptionID2?: string;
  standardLayout?: boolean;
  paymentsOnly?: boolean;
}) {
  const xero = await getXeroApiClient(userId, tenantId);
  if (!xero) {
    throw new Error('Failed to create Xero API client');
  }

  try {

    const response = await xero.accountingApi.getReportProfitAndLoss(
      tenantId,
      options?.fromDate,
      options?.toDate,
      options?.periods,
      options?.timeframe as any,
      options?.trackingCategoryID,
      options?.trackingCategoryID2,
      options?.trackingOptionID,
      options?.trackingOptionID2,
      options?.standardLayout,
      options?.paymentsOnly
    );
    return response.body;
  } catch (error) {
    console.error('Error fetching profit and loss report:', error);
    throw error;
  }
}

/**
 * Get Balance Sheet report from Xero
 */
export async function getBalanceSheetReport(userId: string, tenantId: string, options?: {
  date?: string;
  periods?: number;
  timeframe?: string;
  trackingOptionID1?: string;
  trackingOptionID2?: string;
  standardLayout?: boolean;
  paymentsOnly?: boolean;
}) {
  const xero = await getXeroApiClient(userId, tenantId);
  if (!xero) {
    throw new Error('Failed to create Xero API client');
  }

  try {
    const response = await xero.accountingApi.getReportBalanceSheet(
      tenantId,
      options?.date,
      options?.periods,
      options?.timeframe as any,
      options?.trackingOptionID1,
      options?.trackingOptionID2,
      options?.standardLayout,
      options?.paymentsOnly
    );
    return response.body;
  } catch (error) {
    console.error('Error fetching balance sheet report:', error);
    throw error;
  }
}
