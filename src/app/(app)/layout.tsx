"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, type ReactNode, useState } from "react";
import { SidebarLayout } from "@/components/shared/sidebar-layout";
import { BottomNavigation } from "@/components/shared/bottom-navigation";
import { NoSSR } from "@/components/shared/no-ssr";
import { Chatbot } from "@/components/shared/chatbot";
import { ReadOnlyBanner } from "@/components/subscription/read-only-banner";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { getSubscriptionStatus, checkAndUpdateExpiredSubscriptions } from "@/lib/subscription-checker";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isChatbotOpen, setChatbotOpen] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  // Check subscription status
  useEffect(() => {
    if (!user?.companyId) {
      setCheckingSubscription(false);
      return;
    }

    const checkSubscription = async () => {
      try {
        // First check and update expired subscriptions
        await checkAndUpdateExpiredSubscriptions(user.companyId);
        // Then get current status
        const status = await getSubscriptionStatus(user.companyId);
        setSubscriptionStatus(status);
      } catch (error) {
        console.error('Error checking subscription status:', error);
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkSubscription();
  }, [user?.companyId]);

  useEffect(() => {
    if (isLoading || checkingSubscription) {
      return; // Wait until authentication state is resolved
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    // Allow access to subscription settings page even if expired
    if (pathname === '/settings/subscription') {
      return;
    }

    // If subscription expired, redirect to subscription page for read-only access
    if (subscriptionStatus?.isExpired && pathname !== '/settings/subscription') {
      const currentBaseRoute = pathname.split('/')[1];
      // Allow access to settings pages
      if (currentBaseRoute === 'settings' || currentBaseRoute === 'profile') {
        return;
      }
      // Don't redirect if already on a read-only allowed page
      router.replace('/settings/subscription');
      return;
    }

    const currentBaseRoute = pathname.split('/')[1]; // e.g., "employee", "manager", "admin", "profile"
    const userBaseRoute = user.role;

    // Allow access to profile pages for any role
    if (currentBaseRoute === 'profile') {
      return;
    }

    // Allow access to notifications page for any role
    if (currentBaseRoute === 'notifications') {
      return;
    }

    // Allow access to settings pages
    if (currentBaseRoute === 'settings') {
      return;
    }

    // Allow managers and admins to access employee verify-receipt pages
    if (currentBaseRoute === 'employee' && pathname.includes('/verify-receipt/') && (userBaseRoute === 'manager' || userBaseRoute === 'admin')) {
      return;
    }

    // If the user is on a page that doesn't match their role, redirect them
    if (currentBaseRoute !== userBaseRoute) {
      router.replace(`/${userBaseRoute}/dashboard`);
    }

  }, [user, isLoading, router, pathname, subscriptionStatus, checkingSubscription]);

  if (isLoading || checkingSubscription || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg)]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SidebarLayout userRole={user?.role}>
      {/* Show read-only banner if subscription is expired */}
      {subscriptionStatus?.isExpired && pathname !== '/settings/subscription' && (
        <div className="container mx-auto p-4">
          <ReadOnlyBanner
            reason={subscriptionStatus.reason}
            daysRemaining={subscriptionStatus.daysRemaining}
          />
        </div>
      )}
      {children}
      
      {/* Bottom Navigation for Mobile */}
      <NoSSR>
        <BottomNavigation userRole={user?.role} />
      </NoSSR>

      {/* Chatbot */}
      <NoSSR>
        <Chatbot isOpen={isChatbotOpen} onClose={() => setChatbotOpen(false)} />
      </NoSSR>

      {/* Floating AI Button */}
      <NoSSR>
        <Button
          onClick={() => setChatbotOpen(true)}
          className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full bg-primary hover:bg-primary/90 shadow-lg"
          size="icon"
        >
          <Bot className="h-6 w-6" />
        </Button>
      </NoSSR>
    </SidebarLayout>
  );
}