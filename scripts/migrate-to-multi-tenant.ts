/**
 * Migration Script: Add companyId to existing users and receipts
 * 
 * This script migrates existing ReceiptShield data to the multi-tenant system by:
 * 1. Creating a default "Legacy Company" for existing data
 * 2. Assigning all existing users to this company
 * 3. Assigning all existing receipts to this company
 * 4. Setting the legacy company to have an active subscription with no expiration
 * 
 * Usage:
 *   tsx scripts/migrate-to-multi-tenant.ts
 * 
 * Prerequisites:
 *   - Firebase project must be configured
 *   - Service account credentials must be available
 *   - Firestore database must be accessible
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as readline from 'readline';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  // You'll need to provide your service account credentials
  // For local development, use GOOGLE_APPLICATION_CREDENTIALS environment variable
  // or provide the credentials directly
  const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : null;

  if (!serviceAccount) {
    console.error('❌ Error: Firebase Admin credentials not found.');
    console.error('Please set GOOGLE_APPLICATION_CREDENTIALS environment variable');
    console.error('or provide service account credentials.');
    process.exit(1);
  }

  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

const LEGACY_COMPANY_NAME = 'Legacy Company';
const LEGACY_COMPANY_OWNER_ID = 'legacy-owner';

interface MigrationStats {
  usersUpdated: number;
  receiptsUpdated: number;
  errors: string[];
}

async function promptConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function createLegacyCompany(): Promise<string> {
  console.log('📦 Creating legacy company...');

  const now = new Date();
  const companyData = {
    name: LEGACY_COMPANY_NAME,
    ownerId: LEGACY_COMPANY_OWNER_ID,
    subscriptionTier: 'enterprise' as const,
    subscriptionStatus: 'active' as const,
    // No expiration for legacy company
    currentPeriodEnd: null,
    trialEndsAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    receiptCount: 0, // Will be updated after migration
    userCount: 0, // Will be updated after migration
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  };

  const companyRef = await db.collection('companies').add(companyData);
  console.log(`✅ Legacy company created with ID: ${companyRef.id}`);
  return companyRef.id;
}

async function migrateUsers(companyId: string): Promise<number> {
  console.log('👥 Migrating users...');

  const usersSnapshot = await db.collection('users').get();
  const batch = db.batch();
  let updateCount = 0;

  usersSnapshot.forEach((doc) => {
    const userData = doc.data();
    
    // Skip if user already has a companyId
    if (userData.companyId) {
      console.log(`⚠️  User ${doc.id} already has companyId: ${userData.companyId}`);
      return;
    }

    const updateData: any = {
      companyId,
      updatedAt: Timestamp.now(),
    };

    // Set the first user as company owner if no owner is set
    if (updateCount === 0 && !userData.isCompanyOwner) {
      updateData.isCompanyOwner = true;
      updateData.canManageSubscription = true;
    }

    batch.update(doc.ref, updateData);
    updateCount++;
  });

  if (updateCount > 0) {
    await batch.commit();
    console.log(`✅ Updated ${updateCount} users with companyId`);
  } else {
    console.log('ℹ️  No users to update');
  }

  return updateCount;
}

async function migrateReceipts(companyId: string): Promise<number> {
  console.log('📄 Migrating receipts...');

  const receiptsSnapshot = await db.collection('receipts').get();
  const batch = db.batch();
  let updateCount = 0;

  receiptsSnapshot.forEach((doc) => {
    const receiptData = doc.data();
    
    // Skip if receipt already has a companyId
    if (receiptData.companyId) {
      console.log(`⚠️  Receipt ${doc.id} already has companyId: ${receiptData.companyId}`);
      return;
    }

    batch.update(doc.ref, {
      companyId,
      updatedAt: Timestamp.now(),
    });
    updateCount++;
  });

  if (updateCount > 0) {
    await batch.commit();
    console.log(`✅ Updated ${updateCount} receipts with companyId`);
  } else {
    console.log('ℹ️  No receipts to update');
  }

  return updateCount;
}

async function updateCompanyCounts(companyId: string, userCount: number, receiptCount: number): Promise<void> {
  console.log('📊 Updating company counts...');

  await db.collection('companies').doc(companyId).update({
    userCount,
    receiptCount,
    updatedAt: Timestamp.now(),
  });

  console.log(`✅ Updated company counts: ${userCount} users, ${receiptCount} receipts`);
}

async function main() {
  console.log('🚀 Starting multi-tenant migration...\n');

  // Safety check
  const confirmed = await promptConfirmation(
    'This will modify your Firestore database. Are you sure you want to continue?'
  );

  if (!confirmed) {
    console.log('❌ Migration cancelled by user.');
    process.exit(0);
  }

  const stats: MigrationStats = {
    usersUpdated: 0,
    receiptsUpdated: 0,
    errors: [],
  };

  try {
    // Check if legacy company already exists
    const existingCompanies = await db
      .collection('companies')
      .where('name', '==', LEGACY_COMPANY_NAME)
      .get();

    let companyId: string;

    if (!existingCompanies.empty) {
      companyId = existingCompanies.docs[0].id;
      console.log(`ℹ️  Legacy company already exists with ID: ${companyId}`);
      
      const overwrite = await promptConfirmation(
        'Do you want to continue with the existing legacy company?'
      );
      if (!overwrite) {
        console.log('❌ Migration cancelled.');
        process.exit(0);
      }
    } else {
      companyId = await createLegacyCompany();
    }

    // Migrate users
    try {
      stats.usersUpdated = await migrateUsers(companyId);
    } catch (error) {
      const errorMsg = `Error migrating users: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }

    // Migrate receipts
    try {
      stats.receiptsUpdated = await migrateReceipts(companyId);
    } catch (error) {
      const errorMsg = `Error migrating receipts: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }

    // Update company counts
    try {
      await updateCompanyCounts(companyId, stats.usersUpdated, stats.receiptsUpdated);
    } catch (error) {
      const errorMsg = `Error updating company counts: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }

    // Print summary
    console.log('\n📋 Migration Summary:');
    console.log(`   Users updated: ${stats.usersUpdated}`);
    console.log(`   Receipts updated: ${stats.receiptsUpdated}`);
    console.log(`   Company ID: ${companyId}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach((error) => console.log(`   - ${error}`));
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run migration
main()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

