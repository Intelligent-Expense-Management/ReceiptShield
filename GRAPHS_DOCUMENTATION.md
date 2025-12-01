# ReceiptShield Graphs & Charts Documentation

## Overview

This document describes all graphs and charts used in ReceiptShield. All charts use the **Recharts** library and are responsive.

---

## Employee Analytics Charts

### 1. Monthly Spend Chart
**Location**: `src/components/analytics/monthly-spend-chart.tsx`  
**Type**: Line Chart  
**Shows**: Spending trends over time (monthly)  
**Features**:
- Line graph showing amount spent per month
- Trend indicator (up/down percentage)
- Tooltip shows exact amount on hover
- Displays last N months of data

**Data Format**:
```typescript
{ month: "2024-01", amount: 1234.56 }[]
```

---

### 2. Category Breakdown Chart
**Location**: `src/components/analytics/category-breakdown-chart.tsx`  
**Type**: Pie Chart or Bar Chart (toggleable)  
**Shows**: Spending by category  
**Features**:
- Switch between pie and bar view
- Shows amount and percentage per category
- Color-coded categories
- Top 4 categories listed below chart

**Data Format**:
```typescript
{ category: "Meals", amount: 500, percentage: 45.5 }[]
```

---

### 3. Status Breakdown Chart
**Location**: `src/components/analytics/status-breakdown-chart.tsx`  
**Type**: Bar Chart  
**Shows**: Receipts by status (Approved, Pending, Rejected, Draft)  
**Features**:
- Color-coded by status (Green=Approved, Yellow=Pending, Red=Rejected, Gray=Draft)
- Shows count and total amount per status
- Status summary cards below chart
- Icons for each status type

**Data Format**:
```typescript
{ status: "Approved", count: 10, amount: 1500 }[]
```

---

### 4. User vs Average Chart
**Location**: `src/components/analytics/user-vs-average-chart.tsx`  
**Type**: Bar Chart  
**Shows**: Comparison of user spending vs company average  
**Features**:
- Side-by-side bars (Your Spending vs Company Average)
- Percentage difference indicator
- Summary cards showing both amounts
- Color-coded message (green=below average, red=above average)

**Data Format**:
```typescript
{ userSpent: 2000, averageSpent: 1500, period: "this_month" }
```

---

## Manager Analytics Charts

### 5. Department Spend Chart
**Location**: `src/components/manager-analytics/department-spend-chart.tsx`  
**Type**: Bar Chart  
**Shows**: Total spending per department  
**Features**:
- Horizontal bars for each department
- Color-coded departments
- Shows total spend, top department, and average per department
- Summary stats: total departments, avg per dept, total receipts

**Data Format**:
```typescript
{ department: "Sales", amount: 5000, count: 25 }[]
```

---

### 6. Employee Leaderboard Chart
**Location**: `src/components/manager-analytics/employee-leaderboard-chart.tsx`  
**Type**: Bar Chart  
**Shows**: Top spending employees  
**Features**:
- Ranked by spending amount
- Trophy icons for top 3 (Gold, Silver, Bronze)
- Shows employee name, department, amount, and receipt count
- Top 3 performers highlighted below chart

**Data Format**:
```typescript
{ employee: "John Doe", amount: 2000, count: 15, department: "Sales" }[]
```

---

### 7. Vendor Analysis Chart (Pareto Chart)
**Location**: `src/components/manager-analytics/vendor-analysis-chart.tsx`  
**Type**: Composed Chart (Bar + Line)  
**Shows**: Spending by vendor with Pareto analysis  
**Features**:
- Bar chart shows spending per vendor
- Line chart shows cumulative percentage (80/20 rule)
- Risk level indicator (High/Medium/Low concentration)
- Top 5 vendors listed
- Shows how many vendors account for 80% of spend

**Data Format**:
```typescript
{ vendor: "Amazon", amount: 5000, percentage: 25, cumulativePercentage: 45 }[]
```

---

### 8. Department Trends Chart
**Location**: `src/components/manager-analytics/department-trends-chart.tsx`  
**Type**: Line Chart (Multi-line)  
**Shows**: Spending trends over time by department  
**Features**:
- Multiple lines (one per department)
- Shows growth rate per department
- Growth analysis cards (positive/negative/stable)
- Summary stats: total period spend, avg per month, active departments

**Data Format**:
```typescript
{ month: "2024-01", Sales: 5000, Marketing: 3000, IT: 2000 }[]
```

---

### 9. Fraud Outliers Chart
**Location**: `src/components/manager-analytics/fraud-outliers-chart.tsx`  
**Type**: Bar Chart  
**Shows**: Employees with unusual spending patterns  
**Features**:
- Red bars for outliers, colored bars for normal spenders
- Z-score calculation for statistical outliers
- Risk level badges (Critical/High/Medium/Low)
- Outlier details: employee, department, amount, z-score
- Summary: total employees, outliers count, normal spenders, risk level

**Data Format**:
```typescript
{ employee: "John Doe", department: "Sales", amount: 5000, isOutlier: true, zScore: 2.5 }[]
```

---

### 10. Manager Overview Charts
**Location**: `src/components/manager/manager-overview-charts.tsx`  
**Type**: Bar Chart  
**Shows**: Monthly expense trends for team (last 6 months)  
**Features**:
- Simple bar chart showing monthly totals
- 4 summary cards: Total Expenses, Receipts Submitted, Fraud Alerts, Pending Approvals
- Tooltip shows exact dollar amount

**Data Format**:
```typescript
{ name: "Jan", total: 5000 }[]
```

---

## Monitoring Charts

### 11. Business Analytics Charts
**Location**: `src/components/monitoring/business-analytics.tsx`  
**Type**: Bar Chart + Pie Chart  
**Shows**: Platform-wide business metrics  
**Features**:
- **User Growth Chart**: Bar chart showing new users over time
- **Feature Usage Chart**: Pie chart showing feature popularity
- 4 metric cards: Total Users, Active Users, Avg Session, Revenue
- Time range selector (1d, 7d, 30d, 90d)

**Data Format**:
```typescript
// User Growth
{ date: "Mon", users: 10 }[]

// Feature Usage
{ name: "Receipt Upload", usage: 500 }[]
```

---

### 12. Realtime Charts
**Location**: `src/components/monitoring/realtime-charts.tsx`  
**Type**: Area Chart + Line Chart + Bar Chart  
**Shows**: Real-time system metrics  
**Features**:
- **Active Users**: Area chart (updates every 30s)
- **Response Time**: Line chart showing API response times
- **Error Rate**: Bar chart showing error percentages
- **System Uptime**: Line chart (95-100% range)
- Auto-refreshes every 30 seconds

**Data Format**:
```typescript
{ timestamp: "10:30 AM", activeUsers: 50, responseTime: 200, errorRate: 0.5, uptime: 99.5 }[]
```

---

## Chart Library

**Library**: Recharts (`recharts@^2.15.4`)  
**Components Used**:
- `BarChart`, `Bar` - Bar charts
- `LineChart`, `Line` - Line charts
- `PieChart`, `Pie` - Pie charts
- `ComposedChart` - Combined bar + line
- `AreaChart`, `Area` - Area charts
- `ResponsiveContainer` - Makes all charts responsive

---

## Common Features

All charts include:
- **Responsive Design**: Adapts to screen size
- **Tooltips**: Hover to see detailed values
- **Color Coding**: Consistent color scheme
- **Empty States**: Shows message when no data
- **Loading States**: Skeleton loaders while fetching
- **Currency Formatting**: All amounts in USD ($X.XX)

---

## Color Scheme

**Primary Colors**:
- Blue: `#3b82f6` - Primary data
- Green: `#10b981` - Positive/approved
- Red: `#ef4444` - Negative/rejected/outliers
- Yellow: `#f59e0b` - Warning/pending
- Purple: `#8b5cf6` - Secondary data
- Orange: `#f97316` - Alerts

**Status Colors**:
- Approved: Green
- Pending: Yellow/Amber
- Rejected: Red
- Draft: Gray

---

## Data Sources

Charts get data from:
- **Employee Charts**: `getUserSpendingAnalytics()` from `data-service.ts`
- **Manager Charts**: `getManagerAnalytics()` from manager analytics API
- **Monitoring Charts**: `/api/monitoring/*` endpoints

---

## Quick Reference

| Chart | Type | Location | Purpose |
|-------|------|----------|---------|
| Monthly Spend | Line | Employee Analytics | Show spending trends |
| Category Breakdown | Pie/Bar | Employee Analytics | Show spending by category |
| Status Breakdown | Bar | Employee Analytics | Show receipt statuses |
| User vs Average | Bar | Employee Analytics | Compare to company average |
| Department Spend | Bar | Manager Analytics | Show spending by department |
| Employee Leaderboard | Bar | Manager Analytics | Rank top spenders |
| Vendor Analysis | Composed | Manager Analytics | Pareto analysis of vendors |
| Department Trends | Line | Manager Analytics | Show trends over time |
| Fraud Outliers | Bar | Manager Analytics | Identify unusual spending |
| Manager Overview | Bar | Manager Dashboard | Monthly team expenses |
| Business Analytics | Bar/Pie | Monitoring | Platform metrics |
| Realtime Charts | Area/Line/Bar | Monitoring | Live system metrics |

---

## Usage Example

```tsx
import { MonthlySpendChart } from '@/components/analytics/monthly-spend-chart';

<MonthlySpendChart 
  data={[
    { month: "2024-01", amount: 1500 },
    { month: "2024-02", amount: 2000 }
  ]} 
/>
```

---

**Last Updated**: [Current Date]  
**Chart Library Version**: Recharts 2.15.4

