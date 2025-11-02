'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Shield, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export function SignupForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // All signups are admin by default, creating a new company
  const role: UserRole = 'admin';
  
  const { createAccount, user, isLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // If the user is already logged in, redirect them.
    if (!isLoading && user) {
        if (user.role === 'admin') {
            router.push('/admin/dashboard');
        } else if (user.role === 'manager') {
            router.push('/manager/dashboard');
        } else {
            router.push('/employee/dashboard');
        }
    }
  }, [user, isLoading, router]);

  const validateStep1 = (): boolean => {
    if (!name.trim()) {
      toast({ title: 'Validation Error', description: 'Full name is required.', variant: 'destructive' });
      return false;
    }
    if (!email) {
      toast({ title: 'Validation Error', description: 'Email is required.', variant: 'destructive' });
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast({ title: 'Validation Error', description: 'Please enter a valid email address.', variant: 'destructive' });
      return false;
    }
    if (!password) {
      toast({ title: 'Validation Error', description: 'Password is required.', variant: 'destructive' });
      return false;
    }
    if (password.length < 6) {
      toast({ title: 'Validation Error', description: 'Password must be at least 6 characters long.', variant: 'destructive' });
      return false;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Validation Error', description: "Passwords don't match.", variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep1()) return;
    // Always go to step 2 for company creation (everyone is admin)
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validate step 1 again if coming from step 2
    if (!validateStep1()) return;
    
    if (!companyName.trim()) {
      toast({ title: 'Validation Error', description: 'Company name is required.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    const showErrorToast = (description: string) => {
        toast({
            title: 'Creation Failed',
            description,
            variant: 'destructive',
        });
    }

    try {
      const response = await createAccount(name, email, password, role, undefined, companyName);
      if (!response.success) {
        showErrorToast(response.message || "Failed to create account.");
      }
    } catch (error) {
      console.error('Authentication error:', error);
      showErrorToast('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Shield className="w-16 h-16 text-primary" />
        </div>
        <CardTitle className="text-3xl font-headline">
          Create Account
        </CardTitle>
        <CardDescription>
          {step === 1 
            ? 'Step 1: Enter your personal details'
            : 'Step 2: Set up your company'}
        </CardDescription>
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className={`h-2 w-12 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-gray-200'}`} />
          <div className={`h-2 w-12 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`} />
        </div>
      </CardHeader>
      <CardContent>
        {step === 1 ? (
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              You'll be creating a new company and will be the owner with full control.
            </p>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Continue to Company Setup
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Company Information</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Your Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                This will be your organization's name in ReceiptShield.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry (Optional)</Label>
              <Input
                id="industry"
                type="text"
                placeholder="e.g., Technology, Healthcare, Finance"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Help us customize your experience.
              </p>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-foreground">
                <strong>What happens next?</strong>
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>You'll be the company owner with full control</li>
                <li>Your company will start with a 14-day free trial</li>
                <li>You can invite team members after account creation</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="flex-1"
                disabled={isSubmitting}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
        <div className="text-center text-sm text-gray-600">
          <Link href="/" className="text-primary hover:underline">
            ← Back to Receipt Shield
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
