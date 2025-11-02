# Missing Firestore Indexes - Action Required

## Currently Missing Indexes

Based on your Firestore indexes list, you need to create the following **companyId-based indexes**:

### 1. **RECEIPTS - companyId + uploadedAt** ⚠️ **REQUIRED (Current Error)**
```
Collection: receipts
Fields:
  - companyId (Ascending) 
  - uploadedAt (Descending)
```
**Click this link to create it:**
https://console.firebase.google.com/v1/r/project/recieptshield/firestore/indexes?create_composite=Ck5wcm9qZWN0cy9yZWNpZXB0c2hpZWxkL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9yZWNlaXB0cy9pbmRleGVzL18QARoNCgljb21wYW55SWQQARoOCgp1cGxvYWRlZEF0EAIaDAoIX19uYW1lX18QAg

### 2. RECEIPTS - companyId + status + uploadedAt
```
Collection: receipts
Fields:
  - companyId (Ascending)
  - status (Ascending)
  - uploadedAt (Descending)
```

### 3. RECEIPTS - companyId + supervisorId + uploadedAt
```
Collection: receipts
Fields:
  - companyId (Ascending)
  - supervisorId (Ascending)
  - uploadedAt (Descending)
```

### 4. USERS - companyId + role + status
```
Collection: users
Fields:
  - companyId (Ascending)
  - role (Ascending)
  - status (Ascending)
```

### 5. INVITATIONS - companyId + createdAt
```
Collection: invitations
Fields:
  - companyId (Ascending)
  - createdAt (Descending)
```

## How to Create

**Option 1: Use Firebase Console (Quick)**
1. Go to: https://console.firebase.google.com/project/recieptshield/firestore/indexes
2. Click "Create Index" for each missing index above
3. Fill in the collection and fields as shown
4. Wait for indexes to build (few minutes)

**Option 2: Deploy via CLI**
```bash
firebase deploy --only firestore:indexes
```

## Status

Once indexes are created and show "Enabled" status, the errors will be resolved.

