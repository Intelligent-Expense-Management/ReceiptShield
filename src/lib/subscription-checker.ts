import { getCompany, updateCompanySubscription } from './firebase-company-store';
import type { Company } from '@/types';

/**
 * Check if a company's trial has expired and subscription is not active
 * Updates company status to 'expired' if needed
 */
export async function checkAndUpdateExpiredSubscriptions(companyId: string): Promise<{
  isExpired: boolean;
  wasUpdated: boolean;
}> {
  try {
    const company = await getCompany(companyId);
    if (!company) {
      return { isExpired: true, wasUpdated: false };
    }

    const now = new Date();
    let isExpired = false;
    let needsUpdate = false;

    // Check if trial expired
    if (company.subscriptionStatus === 'trialing' && company.trialEndsAt) {
      if (now > company.trialEndsAt) {
        isExpired = true;
        // Only update if status is still 'trialing'
        if (company.subscriptionStatus === 'trialing') {
          needsUpdate = true;
        }
      }
    }
    // Check if subscription expired
    else if (company.currentPeriodEnd) {
      if (now > company.currentPeriodEnd && company.subscriptionStatus !== 'expired') {
        isExpired = true;
        if (company.subscriptionStatus === 'active' || company.subscriptionStatus === 'past_due') {
          needsUpdate = true;
        }
      }
    }

    // Update status if needed
    if (needsUpdate) {
      await updateCompanySubscription(companyId, {
        subscriptionStatus: 'expired',
      });
      return { isExpired: true, wasUpdated: true };
    }

    return { isExpired, wasUpdated: false };
  } catch (error) {
    console.error('Error checking subscription expiration:', error);
    return { isExpired: false, wasUpdated: false };
  }
}

/**
 * Check subscription status for a company (synchronous check)
 */
export async function getSubscriptionStatus(companyId: string): Promise<{
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining?: number;
  reason?: string;
}> {
  try {
    const company = await getCompany(companyId);
    if (!company) {
      return {
        isActive: false,
        isTrial: false,
        isExpired: true,
        reason: 'Company not found',
      };
    }

    const now = new Date();
    const isTrial = company.subscriptionStatus === 'trialing';
    const isActive = company.subscriptionStatus === 'active' || isTrial;

    let isExpired = false;
    let daysRemaining: number | undefined;
    let reason: string | undefined;

    if (isTrial && company.trialEndsAt) {
      const trialEnd = company.trialEndsAt;
      isExpired = now > trialEnd;
      daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (isExpired) {
        reason = 'Your trial has expired. Please subscribe to continue.';
      } else if (daysRemaining <= 3) {
        reason = `Your trial expires in ${daysRemaining} days. Consider upgrading to continue.`;
      }
    } else if (company.currentPeriodEnd) {
      isExpired = now > company.currentPeriodEnd;
      if (isExpired) {
        reason = 'Your subscription has expired. Please update your payment method.';
      }
    }

    if (!isActive || isExpired || company.subscriptionStatus === 'canceled') {
      isExpired = true;
      reason = reason || 'Your subscription is not active. Please subscribe to continue.';
    }

    return {
      isActive: isActive && !isExpired && company.subscriptionStatus !== 'canceled',
      isTrial,
      isExpired,
      daysRemaining,
      reason,
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return {
      isActive: false,
      isTrial: false,
      isExpired: true,
      reason: 'Error checking subscription status',
    };
  }
}

