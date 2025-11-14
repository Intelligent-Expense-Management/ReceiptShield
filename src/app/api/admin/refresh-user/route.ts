import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * API route to refresh user data from Firestore
 * Call this after updating user permissions in Firestore
 * 
 * Usage: POST /api/admin/refresh-user
 * Requires: Authorization header with Firebase ID token
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    if (!auth) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK not initialized' },
        { status: 500 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase token
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get fresh user data from Firestore
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        isPlatformAdmin: userData.isPlatformAdmin || false,
        companyId: userData.companyId,
        isCompanyOwner: userData.isCompanyOwner || false,
        canManageSubscription: userData.canManageSubscription || false,
      },
      message: 'User data refreshed. Please log out and log back in for changes to take effect.',
    });
  } catch (error) {
    console.error('Error refreshing user:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

