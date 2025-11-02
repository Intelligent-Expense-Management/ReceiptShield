/**
 * Script to set a user as platform admin
 * Usage: npx tsx scripts/set-platform-admin.ts <userId>
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (!serviceAccount) {
    console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
    console.error('Please set it with your Firebase service account JSON');
    process.exit(1);
  }

  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function setPlatformAdmin(userId: string) {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error(`Error: User with ID ${userId} not found`);
      process.exit(1);
    }

    const userData = userDoc.data();
    console.log('Current user data:', {
      name: userData?.name,
      email: userData?.email,
      role: userData?.role,
      isPlatformAdmin: userData?.isPlatformAdmin || false,
    });

    // Update user to be platform admin
    await userRef.update({
      isPlatformAdmin: true,
      updatedAt: new Date(),
    });

    console.log(`✅ Successfully set ${userData?.name} (${userData?.email}) as platform admin`);
    console.log('User can now access the Platform Dashboard at /platform/dashboard');
  } catch (error) {
    console.error('Error setting platform admin:', error);
    process.exit(1);
  }
}

// Get userId from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: npx tsx scripts/set-platform-admin.ts <userId>');
  console.error('Example: npx tsx scripts/set-platform-admin.ts qJACQ0m7fqOAZ58e1ALV8bgmwAe2');
  process.exit(1);
}

setPlatformAdmin(userId)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

