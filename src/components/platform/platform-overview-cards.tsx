'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, FileText, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react';
import { getAllCompanies } from '@/lib/firebase-company-store';
import { getUsers } from '@/lib/firebase-user-store';
import { getAllReceipts } from '@/lib/receipt-store';
import type { Company } from '@/types';

interface PlatformStats {
  totalCompanies: number;
  activeSubscriptions: number;
  totalUsers: number;
  totalReceipts: number;
  monthlyRevenue: number;
  trialsExpiringSoon: number;
}

export function PlatformOverviewCards() {
  const [stats, setStats] = useState<PlatformStats>({
    totalCompanies: 0,
    activeSubscriptions: 0,
    totalUsers: 0,
    totalReceipts: 0,
    monthlyRevenue: 0,
    trialsExpiringSoon: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlatformStats = async () => {
      try {
        setIsLoading(true);

        // Fetch all data (no company filtering for platform admin)
        const [companies, users, receipts] = await Promise.all([
          getAllCompanies(),
          getUsers(), // No companyId = all users
          getAllReceipts(), // No companyId = all receipts
        ]);

        // Calculate stats
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const activeSubscriptions = companies.filter(
          (c) => c.subscriptionStatus === 'active' || c.subscriptionStatus === 'trialing'
        ).length;

        const trialsExpiringSoon = companies.filter((c) => {
          if (c.subscriptionStatus !== 'trialing' || !c.trialEndsAt) return false;
          const trialEnd = c.trialEndsAt instanceof Date ? c.trialEndsAt : new Date(c.trialEndsAt);
          return trialEnd >= now && trialEnd <= sevenDaysFromNow;
        }).length;

        // Calculate monthly recurring revenue (MRR)
        const subscriptionPrices: Record<string, number> = {
          basic: 29,
          professional: 79,
          enterprise: 199,
        };

        const monthlyRevenue = companies.reduce((total, company) => {
          if (company.subscriptionStatus === 'active' && company.subscriptionTier !== 'trial') {
            return total + (subscriptionPrices[company.subscriptionTier] || 0);
          }
          return total;
        }, 0);

        setStats({
          totalCompanies: companies.length,
          activeSubscriptions,
          totalUsers: users.length,
          totalReceipts: receipts.length,
          monthlyRevenue,
          trialsExpiringSoon,
        });
      } catch (error) {
        console.error('Error fetching platform stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlatformStats();
  }, []);

  const cards = [
    {
      title: 'Total Companies',
      value: stats.totalCompanies,
      icon: Building2,
      description: 'Companies registered',
      trend: null,
    },
    {
      title: 'Active Subscriptions',
      value: stats.activeSubscriptions,
      icon: CreditCard,
      description: 'Active or trialing',
      trend: null,
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      description: 'Across all companies',
      trend: null,
    },
    {
      title: 'Total Receipts',
      value: stats.totalReceipts,
      icon: FileText,
      description: 'All receipts processed',
      trend: null,
    },
    {
      title: 'Monthly Revenue',
      value: `$${stats.monthlyRevenue.toLocaleString()}`,
      icon: TrendingUp,
      description: 'Monthly recurring revenue',
      trend: null,
    },
    {
      title: 'Trials Expiring',
      value: stats.trialsExpiringSoon,
      icon: AlertTriangle,
      description: 'Next 7 days',
      variant: stats.trialsExpiringSoon > 0 ? 'destructive' : 'default',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              {card.title === 'Trials Expiring' && stats.trialsExpiringSoon > 0 && (
                <Badge variant="destructive" className="mt-2">
                  Action Required
                </Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

