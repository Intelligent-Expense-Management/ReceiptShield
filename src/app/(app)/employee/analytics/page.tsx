"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Receipt } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getUserSpendingAnalytics, getUserReceipts, type SpendingAnalytics } from "@/lib/data-service";
import { MonthlySpendChart } from "@/components/analytics/monthly-spend-chart";
import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import type { ProcessedReceipt } from "@/types";

// Helper function to get receipt total amount (same as in data-service)
function getReceiptTotalAmount(receipt: ProcessedReceipt): number {
  const amountItem = receipt.items?.find(i => 
    i.label.toLowerCase().includes('total amount') || 
    i.label.toLowerCase().includes('amount') ||
    (i.label.toLowerCase().includes('total') && !i.label.toLowerCase().includes('tax'))
  );
  if (!amountItem) return 0;
  const amountValue = parseFloat(amountItem.value.replace(/[^0-9.-]+/g, "") || "0");
  return isNaN(amountValue) ? 0 : amountValue;
}

export default function EmployeeAnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<SpendingAnalytics | null>(null);
  const [allReceipts, setAllReceipts] = useState<ProcessedReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.email) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const [analyticsData, receipts] = await Promise.all([
          getUserSpendingAnalytics(user.email),
          getUserReceipts(user.email)
        ]);
        setAnalytics(analyticsData);
        setAllReceipts(receipts);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError('Failed to load analytics data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.email]);

  // Calculate current month totals from all receipts
  const currentMonth = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const currentMonthReceipts = allReceipts.filter(receipt => {
    const receiptDate = new Date(receipt.uploadedAt);
    return isWithinInterval(receiptDate, { start: monthStart, end: monthEnd });
  });

  const currentMonthTotal = currentMonthReceipts.reduce((sum, receipt) => {
    return sum + getReceiptTotalAmount(receipt);
  }, 0);

  const currentMonthAverage = currentMonthReceipts.length > 0 
    ? currentMonthTotal / currentMonthReceipts.length 
    : 0;

  const topCategory = analytics?.categoryBreakdown[0]?.category || "N/A";

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-500 mb-2">{error || 'Failed to load analytics'}</p>
            <p className="text-sm text-gray-500">Please try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Spending Analytics</h1>
        <p className="text-gray-600 mt-2">Track your expense patterns and spending insights</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${currentMonthTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average per Receipt</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${currentMonthAverage.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Category</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topCategory}</div>
            <p className="text-xs text-muted-foreground">Most spent category</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonthReceipts.length}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Spending Trend</CardTitle>
            <CardDescription>Your spending pattern over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.monthlyTrends.length > 0 ? (
              <MonthlySpendChart data={analytics.monthlyTrends} />
            ) : (
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No spending data available yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Breakdown of your expenses by category</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.categoryBreakdown.length > 0 ? (
              <div className="space-y-4">
                {analytics.categoryBreakdown.map((category, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="font-medium">{category.category}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${category.amount.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">{category.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No category data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}