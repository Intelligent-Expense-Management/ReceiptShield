'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, DollarSign, Clock, Activity } from 'lucide-react';

interface BusinessMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalSessions: number;
  averageSessionDuration: number;
  topFeatures: Array<{ name: string; usage: number }>;
  userGrowth: Array<{ date: string; users: number }>;
  revenue: number;
  conversionRate: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export function BusinessAnalytics() {
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  const fetchBusinessMetrics = async () => {
    try {
      setIsLoading(true);
      
      // Fetch analytics data with authentication
      const [analyticsResponse, performanceResponse] = await Promise.all([
        fetch(`/api/monitoring/analytics?timeRange=${timeRange}`, {
          headers: {
            'Authorization': 'Bearer monitoring-token',
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/monitoring/performance', {
          headers: {
            'Authorization': 'Bearer monitoring-token',
            'Content-Type': 'application/json'
          }
        })
      ]);

      const [analyticsData, performanceData] = await Promise.all([
        analyticsResponse.json(),
        performanceResponse.json()
      ]);

      // Calculate business metrics from analytics data
      // TODO: Replace with real data from Firestore analytics collection
      // For now, use analytics data where available, otherwise show 0
      const businessMetrics: BusinessMetrics = {
        totalUsers: analyticsData.statistics?.uniqueUsers || 0,
        activeUsers: analyticsData.statistics?.uniqueUsers || 0,
        newUsersToday: analyticsData.statistics?.newUsersToday || 0, // TODO: Calculate from user creation dates
        totalSessions: analyticsData.statistics?.totalEvents || 0,
        averageSessionDuration: performanceData.averageResponseTime 
          ? Math.round(performanceData.averageResponseTime / 1000 / 60) 
          : 0, // Convert ms to minutes, or 0 if not available
        topFeatures: analyticsData.topFeatures || [
          // Fallback empty data if not available
          { name: 'Receipt Upload', usage: 0 },
          { name: 'Expense Tracking', usage: 0 },
          { name: 'Reports', usage: 0 },
          { name: 'Settings', usage: 0 },
          { name: 'Profile', usage: 0 }
        ],
        userGrowth: analyticsData.userGrowth || [
          // Fallback empty data if not available
          { date: 'Mon', users: 0 },
          { date: 'Tue', users: 0 },
          { date: 'Wed', users: 0 },
          { date: 'Thu', users: 0 },
          { date: 'Fri', users: 0 },
          { date: 'Sat', users: 0 },
          { date: 'Sun', users: 0 }
        ],
        revenue: analyticsData.revenue || 0, // TODO: Calculate from subscription data
        conversionRate: analyticsData.conversionRate || 0 // TODO: Calculate from trial to paid conversions
      };

      setMetrics(businessMetrics);
    } catch (error) {
      console.error('Failed to fetch business metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessMetrics();
  }, [timeRange]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8 text-gray-500">
          <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Failed to load business analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Business Analytics
          </h2>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Users</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">{metrics.totalUsers}</div>
            <div className="text-sm text-blue-700">+{metrics.newUsersToday} today</div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Active Users</span>
            </div>
            <div className="text-2xl font-bold text-green-900">{metrics.activeUsers}</div>
            <div className="text-sm text-green-700">Currently online</div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Avg Session</span>
            </div>
            <div className="text-2xl font-bold text-purple-900">{metrics.averageSessionDuration}m</div>
            <div className="text-sm text-purple-700">Session duration</div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-900">Revenue</span>
            </div>
            <div className="text-2xl font-bold text-yellow-900">${metrics.revenue.toLocaleString()}</div>
            <div className="text-sm text-yellow-700">{metrics.conversionRate}% conversion</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Growth Chart */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics.userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="users" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Feature Usage Chart */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Usage</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={metrics.topFeatures}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="usage"
                >
                  {metrics.topFeatures.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
