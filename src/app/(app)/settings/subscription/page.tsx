'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlanSelector } from '@/components/subscription/plan-selector';
import { getCompanyUsageInfo, hasActiveSubscription } from '@/lib/subscription-middleware';
import { getCompany } from '@/lib/firebase-company-store';
import { Calendar, CreditCard, Users, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import type { Company } from '@/types';
import type { SubscriptionPlanKey } from '@/lib/stripe';

export default function SubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [usageInfo, setUsageInfo] = useState<any>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);

  useEffect(() => {
    if (!user?.companyId) {
      router.push('/settings');
      return;
    }

    loadSubscriptionData();
  }, [user, router]);

  const loadSubscriptionData = async () => {
    if (!user?.companyId) return;

    try {
      setLoading(true);
      const [companyData, usage, subscription] = await Promise.all([
        getCompany(user.companyId),
        getCompanyUsageInfo(user.companyId),
        hasActiveSubscription(user.companyId),
      ]);

      setCompany(companyData);
      setUsageInfo(usage);
      setSubscriptionStatus(subscription);
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: SubscriptionPlanKey) => {
    if (!user?.companyId || !user.email) return;

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          companyId: user.companyId,
          companyName: company?.name || 'My Company',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  };

  const handleManageBilling = async () => {
    if (!company?.stripeCustomerId) return;

    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: user?.companyId,
          customerId: company.stripeCustomerId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  if (!company || !usageInfo) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load subscription information. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const receiptUsagePercent = usageInfo.usage.limits.maxReceipts > 0
    ? (usageInfo.usage.receipts / usageInfo.usage.limits.maxReceipts) * 100
    : 0;
  
  const userUsagePercent = usageInfo.usage.limits.maxUsers > 0
    ? (usageInfo.usage.users / usageInfo.usage.limits.maxUsers) * 100
    : 0;

  const canManageBilling = user?.isCompanyOwner || user?.canManageSubscription;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Subscription Management</h1>
        <p className="text-muted-foreground">
          Manage your subscription, view usage, and upgrade your plan.
        </p>
      </div>

      {/* Current Plan Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                {company.name} - {company.subscriptionTier.charAt(0).toUpperCase() + company.subscriptionTier.slice(1)} Plan
              </CardDescription>
            </div>
            <Badge
              variant={
                subscriptionStatus?.isActive
                  ? 'default'
                  : subscriptionStatus?.isExpired
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {subscriptionStatus?.isTrial ? 'Trial' : subscriptionStatus?.isActive ? 'Active' : 'Expired'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscriptionStatus?.isTrial && subscriptionStatus?.daysRemaining !== undefined && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Your trial expires in {subscriptionStatus.daysRemaining} day{subscriptionStatus.daysRemaining !== 1 ? 's' : ''}.
                {subscriptionStatus.daysRemaining <= 3 && (
                  <span className="font-semibold"> Consider upgrading to continue using ReceiptShield.</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {subscriptionStatus?.isExpired && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your subscription has expired. Please upgrade to continue using ReceiptShield.
              </AlertDescription>
            </Alert>
          )}

          {company.currentPeriodEnd && !subscriptionStatus?.isTrial && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Next billing date: {new Date(company.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
          )}

          {canManageBilling && company.stripeCustomerId && (
            <Button onClick={handleManageBilling} variant="outline" className="w-full sm:w-auto">
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Billing
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Receipt Usage
            </CardTitle>
            <CardDescription>
              This month's receipt uploads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{usageInfo.usage.receipts} receipts</span>
                <span className="text-muted-foreground">
                  {usageInfo.usage.limits.maxReceipts > 0
                    ? `of ${usageInfo.usage.limits.maxReceipts}`
                    : 'unlimited'}
                </span>
              </div>
              <Progress
                value={Math.min(100, receiptUsagePercent)}
                className={receiptUsagePercent > 80 ? 'bg-yellow-500' : ''}
              />
              {receiptUsagePercent > 90 && (
                <p className="text-xs text-yellow-600">
                  You're approaching your limit. Consider upgrading.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Usage
            </CardTitle>
            <CardDescription>
              Current number of users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{usageInfo.usage.users} users</span>
                <span className="text-muted-foreground">
                  {usageInfo.usage.limits.maxUsers > 0
                    ? `of ${usageInfo.usage.limits.maxUsers}`
                    : 'unlimited'}
                </span>
              </div>
              {usageInfo.usage.limits.maxUsers > 0 && (
                <>
                  <Progress
                    value={Math.min(100, userUsagePercent)}
                    className={userUsagePercent > 80 ? 'bg-yellow-500' : ''}
                  />
                  {userUsagePercent > 90 && (
                    <p className="text-xs text-yellow-600">
                      You're approaching your limit. Consider upgrading.
                    </p>
                  )}
                </>
              )}
              {usageInfo.usage.limits.maxUsers === -1 && (
                <p className="text-sm text-muted-foreground">Unlimited users</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Choose the plan that best fits your needs. You can upgrade or downgrade at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlanSelector
            currentTier={company.subscriptionTier}
            onSelectPlan={handleSelectPlan}
          />
        </CardContent>
      </Card>
    </div>
  );
}

