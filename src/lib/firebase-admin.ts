import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin configuration
const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "recieptshield",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

// Initialize Firebase Admin
let adminApp;
let adminInitialized = false;

try {
  if (!getApps().length) {
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      });
      adminInitialized = true;
      console.log('✅ Firebase Admin SDK initialized with service account');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Try using GOOGLE_APPLICATION_CREDENTIALS environment variable
      adminApp = initializeApp({
        projectId: serviceAccount.projectId,
      });
      adminInitialized = true;
      console.log('✅ Firebase Admin SDK initialized with GOOGLE_APPLICATION_CREDENTIALS');
    } else {
      // For development, try to use default credentials (gcloud CLI)
      try {
        adminApp = initializeApp({
          projectId: serviceAccount.projectId,
        });
        adminInitialized = true;
        console.log('✅ Firebase Admin SDK initialized with default credentials');
      } catch (defaultCredError) {
        console.warn('⚠️ Firebase Admin credentials not found. Admin SDK features will be limited.');
        console.warn('   To enable full Admin SDK features, set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY');
        console.warn('   Or set GOOGLE_APPLICATION_CREDENTIALS to point to a service account JSON file');
        // Still initialize with project ID for basic operations
        adminApp = initializeApp({
          projectId: serviceAccount.projectId,
        });
        adminInitialized = false;
      }
    }
  } else {
    adminApp = getApps()[0];
    adminInitialized = true;
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error);
  // Don't throw - allow the app to continue but with limited functionality
  console.warn('⚠️ Continuing without full Admin SDK functionality');
  adminInitialized = false;
}

export const auth = adminApp ? getAuth(adminApp) : null;
export const db = adminApp ? getFirestore(adminApp) : null;
export const isAdminInitialized = adminInitialized;
export default adminApp;
