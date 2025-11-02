'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanKey } from '@/lib/stripe';
import type { SubscriptionTier } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface PlanSelectorProps {
  currentTier: SubscriptionTier;
  onSelectPlan: (plan: SubscriptionPlanKey) => Promise<void>;
  isLoading?: boolean;
}

export function PlanSelector({ currentTier, onSelectPlan, isLoading }: PlanSelectorProps) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanKey | null>(null);
  const { toast } = useToast();

  const handlePlanSelect = async (plan: SubscriptionPlanKey) => {
    // Don't allow selecting current plan
    const tierMap: Record<SubscriptionPlanKey, SubscriptionTier> = {
      basic: 'basic',
      professional: 'professional',
      enterprise: 'enterprise',
    };

    if (tierMap[plan] === currentTier && currentTier !== 'trial') {
      toast({
        title: 'Already on this plan',
        description: 'You are currently subscribed to this plan.',
      });
      return;
    }

    setSelectedPlan(plan);
    try {
      await onSelectPlan(plan);
    } catch (error) {
      console.error('Error selecting plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to initiate subscription. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSelectedPlan(null);
    }
  };

  const plans = [
    {
      key: 'basic' as SubscriptionPlanKey,
      name: 'Basic',
      price: '$29',
      period: '/month',
      description: 'Perfect for small teams',
      features: [
        '200 receipts/month',
        '10 users',
        'Basic fraud detection',
        'Email support',
      ],
      popular: false,
    },
    {
      key: 'professional' as SubscriptionPlanKey,
      name: 'Professional',
      price: '$79',
      period: '/month',
      description: 'For growing businesses',
      features: [
        '1,000 receipts/month',
        '50 users',
        'Advanced analytics',
        'Priority support',
        'Enhanced fraud detection',
      ],
      popular: true,
    },
    {
      key: 'enterprise' as SubscriptionPlanKey,
      name: 'Enterprise',
      price: '$199',
      period: '/month',
      description: 'For large organizations',
      features: [
        '5,000 receipts/month',
        'Unlimited users',
        'Advanced analytics',
        'API access',
        'Custom integrations',
        'Priority support',
      ],
      popular: false,
    },
  ];

  const getTierFromPlan = (plan: SubscriptionPlanKey): SubscriptionTier => {
    return plan as SubscriptionTier;
  };

  const isCurrentPlan = (plan: SubscriptionPlanKey) => {
    const tier = getTierFromPlan(plan);
    return tier === currentTier && currentTier !== 'trial';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
      {plans.map((plan) => {
        const isCurrent = isCurrentPlan(plan.key);
        const isSelected = selectedPlan === plan.key;

        return (
          <Card
            key={plan.key}
            className={`relative ${
              plan.popular ? 'border-primary shadow-lg scale-105' : ''
            } ${isCurrent ? 'border-green-500' : ''}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
            )}
            {isCurrent && (
              <div className="absolute -top-3 right-4">
                <Badge className="bg-green-500 text-white">Current Plan</Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.popular ? 'default' : 'outline'}
                disabled={isCurrent || isLoading || isSelected}
                onClick={() => handlePlanSelect(plan.key)}
              >
                {isSelected ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : isCurrent ? (
                  'Current Plan'
                ) : (
                  'Subscribe'
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

