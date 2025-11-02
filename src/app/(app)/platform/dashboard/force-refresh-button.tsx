'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { getCurrentUser } from '@/lib/firebase-auth';
import { useRouter } from 'next/navigation';
import { signOutUser, signInWithEmail } from '@/lib/firebase-auth';
import { useToast } from '@/hooks/use-toast';

export function ForceRefreshButton() {
  const { setUser, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!user?.email) return;
    
    setIsRefreshing(true);
    try {
      // Force logout and login to refresh auth context
      const email = user.email;
      const password = prompt('Please enter your password to refresh:');
      
      if (!password) {
        setIsRefreshing(false);
        return;
      }

      // Sign out
      await signOutUser();
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Sign back in with fresh data
      const freshUser = await signInWithEmail(email, password);
      setUser(freshUser);
      
      toast({
        title: 'User data refreshed',
        description: 'Your platform admin status has been updated.',
      });
      
      // Reload the page to ensure everything is fresh
      window.location.href = '/platform/dashboard';
    } catch (error: any) {
      console.error('Error refreshing user:', error);
      toast({
        title: 'Refresh failed',
        description: error.message || 'Could not refresh user data. Please log out and log back in.',
        variant: 'destructive',
      });
      setIsRefreshing(false);
    }
  };

  return (
    <Button 
      onClick={handleRefresh} 
      variant="outline" 
      size="sm"
      disabled={isRefreshing}
    >
      {isRefreshing ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      {isRefreshing ? 'Refreshing...' : 'Refresh & Relogin'}
    </Button>
  );
}

