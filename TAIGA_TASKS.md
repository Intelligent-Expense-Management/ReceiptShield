# ReceiptShield - Taiga Board Tasks

## 📊 Platform Admin Dashboard (COMPLETED ✅)

### Completed Tasks
- ✅ Create Platform Dashboard route (`/platform/dashboard`) with access control
- ✅ Build Platform Overview Cards component (Total Companies, Active Subscriptions, Total Users, Total Receipts, MRR, Trials Expiring)
- ✅ Create Companies Management Table with search and filtering
- ✅ Implement Subscription Analytics (distribution charts, revenue metrics)
- ✅ Add Platform Dashboard navigation link in sidebar for platform admins
- ✅ Set user as platform admin via API endpoint
- ✅ Fix redirect issues between platform and admin dashboards

---

## 🔄 Remaining Tasks

### 1. Usage Limit Integration
**Priority: High**
**Epic: Subscription Management**

**Tasks:**
- [ ] Add usage limit check before receipt upload in upload component
- [ ] Display usage warnings when approaching limits (80% threshold)
- [ ] Show upgrade prompt when receipt limit is exceeded
- [ ] Add usage limit check before user invitation
- [ ] Display remaining user slots in invitation dialog
- [ ] Show upgrade prompt when user limit is exceeded
- [ ] Add usage tracking to increment counters after successful actions
- [ ] Create usage warning banners for approaching limits

**Acceptance Criteria:**
- Users cannot upload receipts if company has exceeded receipt limit
- Users cannot invite new users if company has exceeded user limit
- Clear error messages with upgrade prompts shown
- Usage counters increment correctly after actions

---

### 2. Subscription Settings & Plan Management
**Priority: High**
**Epic: Subscription Management**

**Tasks:**
- [ ] Enhance subscription settings page with detailed usage graphs
- [ ] Add subscription upgrade/downgrade flow via Stripe Checkout
- [ ] Create plan comparison component showing tier differences
- [ ] Implement subscription cancellation flow
- [ ] Add billing history display (invoices from Stripe)
- [ ] Create subscription change confirmation dialogs
- [ ] Add payment method management UI
- [ ] Display subscription renewal date and next billing amount

**Acceptance Criteria:**
- Company owners can upgrade/downgrade subscriptions
- Stripe Checkout integration works correctly
- Subscription changes reflect immediately in UI
- Billing information is displayed accurately

---

### 3. Trial Expiration & Read-Only Mode
**Priority: Medium**
**Epic: Subscription Management**

**Tasks:**
- [ ] Create background job/service to check trial expiration daily
- [ ] Implement automatic status update when trial expires
- [ ] Add read-only mode banner component (already exists, needs integration)
- [ ] Restrict features when subscription expired (disable uploads, invitations)
- [ ] Create trial expiration warning emails/notifications
- [ ] Add "Renew Subscription" flow from expired state
- [ ] Display trial countdown on admin dashboard
- [ ] Show trial expiration alerts 3 days before expiration

**Acceptance Criteria:**
- Trials automatically expire after 14 days if no subscription
- Read-only mode activates when subscription expired
- Users see clear upgrade prompts when expired
- Trial warnings appear before expiration

---

### 4. Admin Dashboard Company Filtering (ENHANCEMENT)
**Priority: Medium**
**Epic: Multi-Tenant System**

**Tasks:**
- [ ] Verify all admin dashboard components filter by companyId
- [ ] Add company selector if admin has access to multiple companies (future feature)
- [ ] Ensure analytics respect company boundaries
- [ ] Verify fraud alerts are filtered by company
- [ ] Test data isolation across different companies
- [ ] Add company name display in admin dashboard header

**Acceptance Criteria:**
- All admin views show only company-specific data
- Platform admins see all companies, regular admins see only their company
- No data leakage between companies

---

### 5. Data Migration Script
**Priority: Low**
**Epic: System Migration**

**Tasks:**
- [ ] Create migration script to add companyId to existing users
- [ ] Create migration script to add companyId to existing receipts
- [ ] Create default "Legacy Company" for existing data
- [ ] Set legacy company subscription to 'active' with no expiration
- [ ] Add migration validation and rollback capability
- [ ] Document migration process
- [ ] Test migration script on staging data

**Acceptance Criteria:**
- All existing users have companyId assigned
- All existing receipts have companyId assigned
- Legacy company created and linked correctly
- Migration can be run safely without data loss

---

### 6. Platform Admin Dashboard Enhancements
**Priority: Low**
**Epic: Platform Administration**

**Tasks:**
- [ ] Create company detail view page (clicking "View" on company)
- [ ] Add company actions (activate/deactivate, view users, view receipts)
- [ ] Implement company subscription management from platform dashboard
- [ ] Add export capabilities (companies list, revenue reports)
- [ ] Create platform-wide analytics charts (growth trends, revenue over time)
- [ ] Add filtering and sorting to companies table
- [ ] Implement bulk actions for companies
- [ ] Add platform admin user management (manage platform admins)

**Acceptance Criteria:**
- Platform admins can view detailed company information
- Platform admins can manage company subscriptions
- Export functionality works correctly
- Analytics show meaningful platform-wide insights

---

### 7. Testing & Quality Assurance
**Priority: Medium**
**Epic: Quality Assurance**

**Tasks:**
- [ ] Write unit tests for subscription middleware functions
- [ ] Write integration tests for Stripe webhook handlers
- [ ] Test multi-company data isolation
- [ ] Test platform admin access controls
- [ ] Test subscription upgrade/downgrade flows
- [ ] Test trial expiration scenarios
- [ ] Test usage limit enforcement
- [ ] Performance testing with multiple companies

**Acceptance Criteria:**
- All critical paths have test coverage
- No data leaks between companies
- Subscription flows work correctly
- Performance is acceptable with scale

---

### 8. Documentation
**Priority: Low**
**Epic: Documentation**

**Tasks:**
- [ ] Document platform admin setup process
- [ ] Create user guide for subscription management
- [ ] Document company creation and user onboarding
- [ ] Update API documentation with new endpoints
- [ ] Create troubleshooting guide for subscription issues
- [ ] Document Stripe webhook setup process

**Acceptance Criteria:**
- All documentation is clear and up-to-date
- Platform admins can follow setup guide
- Users understand subscription features

---

## 📝 Task Summary by Priority

### High Priority (Complete First)
1. Usage Limit Integration
2. Subscription Settings & Plan Management

### Medium Priority
3. Trial Expiration & Read-Only Mode
4. Admin Dashboard Company Filtering Verification
5. Testing & Quality Assurance

### Low Priority (Nice to Have)
6. Data Migration Script
7. Platform Admin Dashboard Enhancements
8. Documentation

---

## 🎯 Suggested Sprint Planning

### Sprint 1: Subscription Core Features
- Usage Limit Integration
- Subscription Settings Enhancement
- Trial Expiration Warnings

### Sprint 2: Platform Admin & Polish
- Platform Admin Dashboard Enhancements
- Admin Dashboard Verification
- Testing & Quality Assurance

### Sprint 3: Migration & Documentation
- Data Migration Script
- Documentation Updates

---

## 📊 Task Estimation Guide

**Story Points:**
- Small (1-2 points): Simple UI changes, bug fixes
- Medium (3-5 points): New components, API integrations
- Large (8 points): Complex features, major refactoring
- Epic (13+ points): Multi-component features, migrations

**Effort Estimates:**
- Usage Limit Integration: ~8 points
- Subscription Settings: ~8 points
- Trial Expiration: ~5 points
- Platform Enhancements: ~8 points
- Data Migration: ~5 points
- Testing: ~8 points
- Documentation: ~3 points

