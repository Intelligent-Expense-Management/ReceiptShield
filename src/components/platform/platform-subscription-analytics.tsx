'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllCompanies } from '@/lib/firebase-company-store';
import type { Company } from '@/types';

interface SubscriptionDistribution {
  trial: number;
  basic: number;
  professional: number;
  enterprise: number;
}

interface RevenueMetrics {
  mrr: number;
  arr: number;
}

export function PlatformSubscriptionAnalytics() {
  const [distribution, setDistribution] = useState<SubscriptionDistribution>({
    trial: 0,
    basic: 0,
    professional: 0,
    enterprise: 0,
  });
  const [revenue, setRevenue] = useState<RevenueMetrics>({ mrr: 0, arr: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        const companies = await getAllCompanies();

        // Calculate subscription distribution
        const dist: SubscriptionDistribution = {
          trial: 0,
          basic: 0,
          professional: 0,
          enterprise: 0,
        };

        // Calculate revenue (only for active subscriptions)
        const subscriptionPrices: Record<string, number> = {
          basic: 29,
          professional: 79,
          enterprise: 199,
        };

        let mrr = 0;

        companies.forEach((company) => {
          // Count distribution
          const tier = company.subscriptionTier || 'trial';
          if (tier in dist) {
            dist[tier as keyof SubscriptionDistribution]++;
          }

          // Calculate MRR (only for active, non-trial subscriptions)
          if (
            company.subscriptionStatus === 'active' &&
            company.subscriptionTier !== 'trial' &&
            company.subscriptionTier in subscriptionPrices
          ) {
            mrr += subscriptionPrices[company.subscriptionTier];
          }
        });

        setDistribution(dist);
        setRevenue({
          mrr,
          arr: mrr * 12,
        });
      } catch (error) {
        console.error('Error fetching subscription analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const totalSubscriptions =
    distribution.trial + distribution.basic + distribution.professional + distribution.enterprise;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Subscription Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Distribution</CardTitle>
          <CardDescription>Breakdown by subscription tier</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Trial</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {totalSubscriptions > 0
                        ? ((distribution.trial / totalSubscriptions) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                    <span className="text-sm font-semibold">{distribution.trial}</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary"
                    style={{
                      width: `${
                        totalSubscriptions > 0
                          ? (distribution.trial / totalSubscriptions) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Basic</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {totalSubscriptions > 0
                        ? ((distribution.basic / totalSubscriptions) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                    <span className="text-sm font-semibold">{distribution.basic}</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${
                        totalSubscriptions > 0
                          ? (distribution.basic / totalSubscriptions) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Professional</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {totalSubscriptions > 0
                        ? ((distribution.professional / totalSubscriptions) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                    <span className="text-sm font-semibold">{distribution.professional}</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500"
                    style={{
                      width: `${
                        totalSubscriptions > 0
                          ? (distribution.professional / totalSubscriptions) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Enterprise</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {totalSubscriptions > 0
                        ? ((distribution.enterprise / totalSubscriptions) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                    <span className="text-sm font-semibold">{distribution.enterprise}</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${
                        totalSubscriptions > 0
                          ? (distribution.enterprise / totalSubscriptions) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Metrics</CardTitle>
          <CardDescription>Monthly and annual recurring revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Monthly Recurring Revenue</div>
                <div className="text-3xl font-bold">${revenue.mrr.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Active subscriptions only</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Annual Recurring Revenue</div>
                <div className="text-3xl font-bold">${revenue.arr.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Projected ARR (MRR × 12)</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

