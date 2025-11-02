'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowUpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ReadOnlyBannerProps {
  reason?: string;
  daysRemaining?: number;
}

export function ReadOnlyBanner({ reason, daysRemaining }: ReadOnlyBannerProps) {
  const router = useRouter();

  return (
    <Alert variant="destructive" className="mb-4 border-2">
      <AlertCircle className="h-5 w-5" />
      <AlertDescription className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1">
          <p className="font-semibold mb-1">
            {daysRemaining !== undefined && daysRemaining > 0
              ? `Trial Expiring Soon`
              : 'Subscription Expired'}
          </p>
          <p>
            {reason ||
              'Your subscription has expired. Please upgrade to continue using ReceiptShield.'}
          </p>
          {daysRemaining !== undefined && daysRemaining > 0 && (
            <p className="text-sm mt-1">
              Your trial expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}.
            </p>
          )}
        </div>
        <Button
          onClick={() => router.push('/settings/subscription')}
          size="sm"
          className="whitespace-nowrap"
        >
          <ArrowUpCircle className="mr-2 h-4 w-4" />
          Upgrade Now
        </Button>
      </AlertDescription>
    </Alert>
  );
}

