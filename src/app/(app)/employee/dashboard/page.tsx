'use client';

import { OriginDashboardEnhanced } from '@/components/employee/origin-dashboard-enhanced';
import { NoSSR } from '@/components/shared/no-ssr';
import { useAuth } from '@/contexts/auth-context';

export default function EmployeeDashboardPage() {
  const { user } = useAuth();

  return (
    <NoSSR>
      <OriginDashboardEnhanced user={user ?? undefined} />
    </NoSSR>
  );
}
