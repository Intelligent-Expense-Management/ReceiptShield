# Mockup/Placeholder Data Report

This document lists all mockup data, placeholders, and test values found in the ReceiptShield codebase.

## 🔴 Critical Issues (Production Code)

### 1. Mock Users in User Store
**Files:**
- `src/lib/user-store.ts` - Default mock users (Alex Admin, Bob Manager, Charlie Employee, Dana Employee)
- `src/lib/firebase-user-store.ts` - `initializeDefaultUsers()` creates mock users in Firestore

**Impact:** Mock users may be created in production database
**Status:** ⚠️ Needs Fix

### 2. Mock Metrics in Business Analytics
**File:** `src/components/monitoring/business-analytics.tsx`
- Line 55: `newUsersToday: Math.floor(Math.random() * 10)` - Mock data
- Line 57: `averageSessionDuration: Math.floor(Math.random() * 30) + 5` - Mock data
- Line 74: `revenue: Math.floor(Math.random() * 5000) + 1000` - Mock data
- Line 75: `conversionRate: Math.floor(Math.random() * 20) + 5` - Mock data
- Lines 58-73: Hardcoded `topFeatures` and `userGrowth` arrays

**Impact:** Shows fake analytics data to users
**Status:** ⚠️ Needs Fix

### 3. Mock Performance Metrics
**File:** `src/components/monitoring/performance-optimization.tsx`
- Lines 55-61: All performance metrics use `Math.random()`
  - CPU usage, memory usage, disk usage, network latency, database connections, cache hit rate, slow queries

**Impact:** Shows fake performance data
**Status:** ⚠️ Needs Fix

### 4. Mock InvitedBy in Send Invitation
**File:** `src/app/api/send-invitation/route.ts`
- Line 30: `const invitedBy = 'system-admin';` - Hardcoded mock value

**Impact:** All invitations show "system-admin" as inviter instead of actual user
**Status:** ⚠️ Needs Fix

### 5. Mock Admin User in Monitoring Auth
**File:** `src/lib/monitoring-auth.ts`
- Lines 37-43: Returns mock admin user for any Bearer token
- Comment says "For demo, we'll accept any token and return a mock admin user"

**Impact:** Security issue - any token grants admin access
**Status:** 🔴 Critical - Security Risk

### 6. Mock Last Login Date
**File:** `src/app/(app)/admin/users/page.tsx`
- Line 137: Comment says "Generate last login date (mock for now - would come from auth logs)"
- Uses `createdAt` date as fallback

**Impact:** Shows incorrect last login dates
**Status:** ⚠️ Needs Fix (Low Priority)

### 7. Random Read Status in Notifications
**File:** `src/app/(app)/notifications/page.tsx`
- ~~Lines 117, 131, 145, 160, 175, 208: `read: Math.random() > 0.X` - Random read status~~ ✅ FIXED
- Now: All notifications default to `read: false` with TODO comments for Firestore persistence
- Also fixed: Now uses `getAllReceipts()` from `firebase-receipt-store` with company filtering
- Also fixed: Only shows notifications for current user's receipts
- Also fixed: Uses `getUsers()` from `firebase-user-store` with company filtering

**Impact:** Notification read status is now consistent (all unread by default)
**Status:** ✅ Fixed - Read status now defaults to false. TODO: Create Firestore notifications collection for persistence

## 🟡 Placeholder Files (Non-Critical)

### 1. ML Fraud Service Placeholder
**File:** `src/lib/ml-fraud-service.ts`
- Returns `null` and deprecated functions
- Has warning to use `/api/ml-predict` instead

**Status:** ✅ OK - Deprecated, warns users

### 2. Enhanced OCR Service Placeholder
**File:** `src/lib/enhanced-ocr-service.ts`
- Returns disabled message
- Placeholder implementation

**Status:** ✅ OK - Returns clear disabled message

### 3. Genkit AI Placeholder
**File:** `src/ai/genkit.ts`
- Line 12: `export const ai = null; // Placeholder for deployment`
- Commented out implementation

**Status:** ✅ OK - Intentionally disabled

### 4. Fraud Detection Flow Placeholder
**File:** `src/ai/flows/flag-fraudulent-receipt.ts`
- Returns `null`
- Placeholder file

**Status:** ✅ OK - Placeholder file

## 🟢 Test/Demo Routes (OK to Keep)

### 1. Test OCR Route
**File:** `src/app/api/test-ocr/route.ts`
- Returns mock OCR response
- This is a test route, mock data is acceptable

**Status:** ✅ OK - Test route

### 2. Test Analytics Route
**File:** `src/app/api/test-analytics/route.ts`
- Uses `Math.random()` for test data
- This is a test route

**Status:** ✅ OK - Test route

## 📋 Summary

**Total Issues Found:** 7 critical, 4 placeholder files, 2 test routes

**Priority Fixes:**
1. 🔴 Mock admin user in monitoring-auth.ts (Security Risk)
2. ⚠️ Mock invitedBy in send-invitation route
3. ⚠️ Mock metrics in business-analytics.tsx
4. ⚠️ Mock performance metrics
5. ⚠️ Mock users initialization
6. ⚠️ Random read status in notifications
7. ⚠️ Mock last login date

**Action Required:**
- Fix authentication in monitoring-auth.ts
- Replace all Math.random() with real data fetching
- Remove or make optional the mock user initialization
- Fix invitedBy to use authenticated user
- Store notification read status in Firestore
- Track last login dates in user documents

