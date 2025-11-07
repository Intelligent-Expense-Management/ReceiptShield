# Platform Admin Dashboard - Implementation Plan

<!-- Platform Admin Dashboard Plan - Created: 2024 -->

## Overview

Create a dedicated dashboard for platform administrators (`isPlatformAdmin: true`) to oversee all companies, users, and system-wide analytics across the entire ReceiptShield platform.

---

## Architecture

### 1. Route Structure

- **Route**: `/platform/dashboard` - Main platform admin dashboard (new route)
- **Routing Logic**: If `user.isPlatformAdmin === true`, redirect to `/platform/dashboard` instead of `/admin/dashboard`
- **Access Control**: Restricted to users with `isPlatformAdmin === true`

### 2. Dashboard Sections

#### A. Platform Overview Cards (Top Stats)

- **Total Companies** - Count of all companies in the system
- **Active Subscriptions** - Companies with active/trialing subscriptions
- **Total Users** - All users across all companies
- **Total Receipts** - All receipts across all companies
- **Monthly Recurring Revenue (MRR)** - Sum of all subscription revenue
- **Trials Expiring Soon** - Companies with trials expiring in next 7 days

#### B. Companies Management Table

- **Company List** with columns:
  - Company name
  - Owner name/email
  - Subscription tier & status (with badges)
  - User count
  - Receipt count
  - Created date
  - Trial expiration date
  - Subscription end date
  - Actions:
    - View Details
    - Manage Subscription
    - Activate/Deactivate Company
    - View Company Dashboard (optional)

#### C. Subscription Analytics

- **Subscription Distribution Chart** - Pie/bar chart showing trial/basic/pro/enterprise distribution
- **Revenue Metrics**:
  - MRR (Monthly Recurring Revenue)
  - ARR (Annual Recurring Revenue)
  - Revenue trends over time
- **Trial Conversion Tracking**:
  - Trial → Paid conversion rate
  - Conversion by tier
- **Churn Rate** - Companies that canceled subscriptions

#### D. Platform Users Overview

- **Total Users** across all companies
- **Users by Role** distribution chart
- **Active vs Inactive** users breakdown
- **New Signups Trend** - Chart showing user growth over time
- **Users by Company** - List showing user distribution

#### E. System Health Metrics

- **Receipt Processing Stats**:
  - Total receipts processed
  - Average processing time
  - Fraud detection rate
- **System Usage Trends**:
  - Receipt upload trends
  - User activity patterns
- **Performance Indicators**:
  - Average receipts per company
  - Active companies count
  - Growth metrics

---

## Components to Create

### New Components:

1. **`PlatformOverviewCards.tsx`**

   - Platform-wide statistics cards
   - Location: `src/components/platform/`
   - Displays: Total companies, active subscriptions, total users, total receipts, MRR, trials expiring

2. **`CompaniesManagementTable.tsx`**

   - Full companies table with sorting, filtering, and actions
   - Location: `src/components/platform/`
   - Features:
     - Sortable columns
     - Filter by subscription status/tier
     - Search by company name
     - Actions menu per company

3. **`PlatformSubscriptionAnalytics.tsx`**

   - Charts and visualizations for subscription metrics
   - Location: `src/components/platform/`
   - Charts:
     - Subscription tier distribution (pie chart)
     - Revenue trends (line chart)
     - Trial conversion funnel
     - Churn analysis

4. **`PlatformUsersOverview.tsx`**

   - Users statistics across platform
   - Location: `src/components/platform/`
   - Shows: Role distribution, active/inactive breakdown, signup trends

5. **`CompanyDetailsDialog.tsx`**

   - Modal to view/edit company details
   - Location: `src/components/platform/`
   - Features:
     - Company information
     - Owner details
     - Subscription details
     - User list for company
     - Receipt statistics
     - Action buttons (edit, manage subscription)

6. **`PlatformReceiptsAnalytics.tsx`**

   - Platform-wide receipt analytics
   - Location: `src/components/platform/`
   - Shows: Receipt processing stats, fraud rates, trends

### Modified Components:

1. **Routing Logic** (`src/app/(app)/layout.tsx` or `src/contexts/auth-context.tsx`)

   - Check if user is platform admin on login
   - Redirect to `/platform/dashboard` instead of `/admin/dashboard`

2. **Navigation** (`src/components/shared/modern-sidebar.tsx`)

   - Add "Platform Admin" section for platform admins
   - Show platform admin badge/indicator

---

## Data Fetching Functions

### New Functions in `firebase-company-store.ts`:

1. **`getPlatformStats()`**
   ```typescript
   export async function getPlatformStats(): Promise<{
     totalCompanies: number;
     activeSubscriptions: number;
     totalUsers: number;
     totalReceipts: number;
     mrr: number;
     trialsExpiringSoon: number;
     subscriptionDistribution: {
       trial: number;
       basic: number;
       professional: number;
       enterprise: number;
     };
   }>
   ```

2. **`getCompaniesWithStats()`**
   ```typescript
   export async function getCompaniesWithStats(): Promise<Array<Company & {
     ownerName?: string;
     ownerEmail?: string;
     userCount: number;
     receiptCount: number;
   }>>
   ```

3. **`updateCompanyStatus(companyId, status)`**
   ```typescript
   export async function updateCompanyStatus(
     companyId: string,
     status: 'active' | 'inactive' | 'suspended'
   ): Promise<void>
   ```

4. **`getCompanySubscriptionHistory(companyId)`**
   ```typescript
   export async function getCompanySubscriptionHistory(
     companyId: string
   ): Promise<Array<{
     tier: SubscriptionTier;
     status: SubscriptionStatus;
     startDate: Date;
     endDate?: Date;
   }>>
   ```


### Enhanced Existing Functions:

- Use `getAllCompanies()` - already exists
- Use `getUsers()` without companyId filter - shows all users
- Use `getAllReceipts()` without companyId filter - shows all receipts

---

## Features & Actions

### Company Management:

1. **View Company Details**

   - Company information (name, owner, dates)
   - Subscription details (tier, status, dates)
   - User list for that company
   - Receipt statistics
   - Usage analytics

2. **Activate/Deactivate Companies**

   - Toggle company status
   - Suspend access if needed
   - Reactivate suspended companies

3. **View Subscription History**

   - Track subscription changes over time
   - See tier upgrades/downgrades
   - Payment history

4. **Manual Subscription Adjustments** (Optional - for support)

   - Change subscription tier
   - Extend trial period
   - Apply discounts/credits

### User Management:

1. **View All Users**

   - List all users across all companies
   - Filter by company
   - Search by name/email
   - View user details and activity

2. **User Activity Tracking**

   - Recent activity per user
   - Login history
   - Receipt submission stats

### Analytics:

1. **Platform-wide Receipt Analytics**

   - Total receipts processed
   - Receipts by company
   - Fraud detection rates
   - Processing trends

2. **Revenue Reporting**

   - MRR breakdown
   - ARR calculation
   - Revenue by tier
   - Payment success/failure rates

3. **Growth Metrics**

   - New company signups over time
   - User growth trends
   - Subscription growth
   - Trial conversion rates

4. **Trial Conversion Tracking**

   - Trial → Paid conversion rate
   - Conversion by tier
   - Common upgrade paths

---

## Implementation Order

### Phase 1: Foundation

1. ✅ Create `/platform/dashboard` route
2. ✅ Update routing logic to redirect platform admins
3. ✅ Create `PlatformOverviewCards` component
4. ✅ Add platform stats fetching functions

### Phase 2: Core Features

5. ✅ Create `CompaniesManagementTable` component
6. ✅ Create `CompanyDetailsDialog` component
7. ✅ Add company management functions

### Phase 3: Analytics

8. ✅ Create `PlatformSubscriptionAnalytics` component
9. ✅ Create `PlatformUsersOverview` component
10. ✅ Create `PlatformReceiptsAnalytics` component

### Phase 4: Navigation & Polish

11. ✅ Update navigation for platform admins
12. ✅ Add platform admin badges/indicators
13. ✅ Polish UI/UX

---

## Security & Permissions

### Access Control:

- **Route Protection**: Only users with `isPlatformAdmin === true` can access `/platform/dashboard`
- **Firestore Rules**: Platform admins can read all companies, users, and receipts
- **Action Logging**: All platform admin actions should be logged for audit trail

### Permissions Matrix:

- **Platform Admin**: Full access to all companies, can manage subscriptions, activate/deactivate companies
- **Company Admin**: Access only to their own company data (existing behavior)
- **Regular Users**: Access only to their assigned company (existing behavior)

---

## UI/UX Considerations

### Design:

- **Clear Distinction**: Platform dashboard should look different from regular admin dashboard
- **"Platform Admin" Badge**: Visible indicator throughout the interface
- **Company Selector**: Optional filter dropdown to view specific company data
- **Export Capabilities**: CSV/PDF export for reports
- **Real-time Updates**: Stats refresh automatically
- **Responsive Design**: Works on mobile/tablet

### User Experience:

- **Intuitive Navigation**: Easy access to all platform-wide features
- **Quick Actions**: Fast access to common tasks
- **Data Visualization**: Charts and graphs for easy understanding
- **Search & Filter**: Powerful search and filtering capabilities

---

## Technical Implementation Details

### Routing Changes:

```typescript
// In auth-context.tsx or layout.tsx
if (user.isPlatformAdmin) {
  router.push('/platform/dashboard');
} else if (user.role === 'admin') {
  router.push('/admin/dashboard');
}
```

### Component Structure:

```
src/
  app/
    (app)/
      platform/
        dashboard/
          page.tsx          # Main platform dashboard page
  components/
    platform/
      platform-overview-cards.tsx
      companies-management-table.tsx
      platform-subscription-analytics.tsx
      platform-users-overview.tsx
      platform-receipts-analytics.tsx
      company-details-dialog.tsx
```

### Data Flow:

1. Platform admin logs in → Check `isPlatformAdmin` flag
2. Redirect to `/platform/dashboard`
3. Fetch platform-wide stats on page load
4. Display overview cards
5. Load companies table with all companies
6. Load analytics data

---

## Questions & Decisions Needed

1. **Routing**: Should platform admins be redirected to `/platform/dashboard` instead of `/admin/dashboard`, or have access to both?

   - **Recommendation**: Redirect to `/platform/dashboard` for clarity

2. **Company Management Actions**: Which actions should be available?

   - ✅ View company details
   - ✅ Activate/deactivate companies
   - ❓ Manually change subscription tier (for support)
   - ❓ Extend trial periods
   - ❓ View Stripe customer details

3. **Analytics Depth**: How detailed should analytics be?

   - ✅ Basic platform stats
   - ✅ Subscription metrics
   - ❓ Per-company breakdowns?
   - ❓ Historical trends (last 6 months, year)?

4. **Navigation**: How should platform admin menu be structured?

   - **Recommendation**: Add "Platform Admin" section at top of sidebar with:
     - Platform Dashboard
     - All Companies
     - All Users
     - Platform Analytics

---

## Future Enhancements (Optional)

1. **Company Selector** - Filter view by specific company
2. **Bulk Actions** - Activate/deactivate multiple companies
3. **Email Notifications** - Alert platform admins of important events
4. **Audit Log** - Track all platform admin actions
5. **Custom Reports** - Generate custom analytics reports
6. **Export Data** - CSV/PDF export functionality
7. **System Settings** - Platform-wide configuration
8. **Usage Warnings** - Alert when companies approach limits

---

## Success Criteria

✅ Platform admins can view all companies and their status

✅ Platform admins can see platform-wide statistics

✅ Platform admins can manage company subscriptions

✅ Analytics show subscription trends and revenue

✅ User management works across all companies

✅ Security is properly enforced (only platform admins access)

✅ UI is intuitive and distinguishes platform admin features

---

## Next Steps

1. Review and approve this plan
2. Begin implementation with Phase 1 (Foundation)
3. Test with platform admin user
4. Iterate based on feedback