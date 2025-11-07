import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;

  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // Use default credentials if available
    initializeApp();
  }
}

const db = getFirestore();

async function checkUserCompany(email: string) {
  try {
    console.log(`\n🔍 Checking company for email: ${email}\n`);

    // Find user by email
    const usersRef = db.collection('users');
    const userQuery = await usersRef.where('email', '==', email.toLowerCase()).get();

    if (userQuery.empty) {
      console.log('❌ User not found with email:', email);
      return;
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    
    console.log('✅ User found:');
    console.log('  - User ID:', userDoc.id);
    console.log('  - Name:', userData.name);
    console.log('  - Email:', userData.email);
    console.log('  - Role:', userData.role);
    console.log('  - Status:', userData.status);
    console.log('  - Company ID:', userData.companyId || 'N/A');
    console.log('  - Is Company Owner:', userData.isCompanyOwner || false);
    console.log('  - Can Manage Subscription:', userData.canManageSubscription || false);
    console.log('  - Is Platform Admin:', userData.isPlatformAdmin || false);

    if (!userData.companyId) {
      console.log('\n⚠️  User is not associated with any company');
      return;
    }

    // Get company information
    const companyRef = db.collection('companies').doc(userData.companyId);
    const companyDoc = await companyRef.get();

    if (!companyDoc.exists) {
      console.log('\n❌ Company not found with ID:', userData.companyId);
      return;
    }

    const companyData = companyDoc.data();
    
    console.log('\n🏢 Company Information:');
    console.log('  - Company ID:', companyDoc.id);
    console.log('  - Company Name:', companyData?.name);
    console.log('  - Owner ID:', companyData?.ownerId);
    console.log('  - Subscription Tier:', companyData?.subscriptionTier);
    console.log('  - Subscription Status:', companyData?.subscriptionStatus);
    
    if (companyData?.trialEndsAt) {
      const trialEndsAt = companyData.trialEndsAt.toDate();
      console.log('  - Trial Ends At:', trialEndsAt.toLocaleString());
    }
    
    if (companyData?.currentPeriodEnd) {
      const currentPeriodEnd = companyData.currentPeriodEnd.toDate();
      console.log('  - Current Period End:', currentPeriodEnd.toLocaleString());
    }
    
    console.log('  - Receipt Count:', companyData?.receiptCount || 0);
    console.log('  - User Count:', companyData?.userCount || 0);
    
    console.log('\n✅ Summary:');
    console.log(`   ${userData.name} (${email}) belongs to "${companyData?.name}"`);
    
  } catch (error) {
    console.error('❌ Error checking user company:', error);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: tsx scripts/check-user-company.ts <email>');
  process.exit(1);
}

checkUserCompany(email).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

