'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { PlatformOverviewCards } from '@/components/platform/platform-overview-cards';
import { CompaniesManagementTable } from '@/components/platform/companies-management-table';
import { PlatformSubscriptionAnalytics } from '@/components/platform/platform-subscription-analytics';
import { ForceRefreshButton } from './force-refresh-button';

export default function PlatformDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Don't do anything while loading
    if (isLoading) {
      return;
    }

    // If no user, redirect to login
    if (!user) {
      router.push('/login');
      return;
    }

    // Debug log to check user status
    console.log('Platform Dashboard - User check:', {
      userId: user.id,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      role: user.role,
      fullUser: user,
    });

    // IMPORTANT: Check if isPlatformAdmin exists and is explicitly true
    // Sometimes it might be undefined which would fail the check
    const isPlatformAdmin = user.isPlatformAdmin === true;

    if (!isPlatformAdmin) {
      console.warn('User is not a platform admin, redirecting...', {
        isPlatformAdmin: user.isPlatformAdmin,
        type: typeof user.isPlatformAdmin,
        userObject: user,
      });
      // Redirect immediately (no delay needed since we've confirmed user is not platform admin)
      if (user.role === 'admin') {
        router.replace('/admin/dashboard');
      } else if (user.role === 'manager') {
        router.replace('/manager/dashboard');
      } else {
        router.replace('/employee/dashboard');
      }
      return;
    }

    // User is platform admin, show dashboard
    console.log('✅ User IS a platform admin, showing dashboard');
    setIsInitializing(false);
  }, [user, isLoading, router]);

  if (isLoading || isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!user.isPlatformAdmin) {
    return (
      <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Platform admin access required</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You need platform admin privileges to access this dashboard.
            </p>
            <p className="text-sm text-muted-foreground">
              Your current status: isPlatformAdmin = {String(user.isPlatformAdmin)}
            </p>
            <p className="text-sm text-muted-foreground">
              User ID: {user.id}
            </p>
            <p className="text-sm text-muted-foreground">
              Email: {user.email}
            </p>
            <div className="flex gap-2 mt-4">
              <ForceRefreshButton />
              <Button onClick={() => router.push('/admin/dashboard')}>
                Go to Admin Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Oversee all companies, subscriptions, and system-wide analytics
          </p>
        </div>
      </div>

      {/* Platform Overview Cards */}
      <PlatformOverviewCards />

      {/* Subscription Analytics */}
      <PlatformSubscriptionAnalytics />

      {/* Companies Management Table */}
      <CompaniesManagementTable />
    </div>
  );
}

