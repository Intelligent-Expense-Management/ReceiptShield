import { NextRequest, NextResponse } from 'next/server';
import { db, auth, isAdminInitialized } from '@/lib/firebase-admin'; // Use Admin SDK for server-side
import { FieldValue } from 'firebase-admin/firestore';

/**
 * API route to set a user as platform admin
 * For development/testing purposes
 * 
 * Usage: POST /api/admin/set-platform-admin
 * Body: { userId: "user-id-here" } OR { email: "user@example.com" }
 * 
 * If no userId/email provided, will try to set the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Check if Admin SDK is initialized
    if (!isAdminInitialized || !auth || !db) {
      return NextResponse.json(
        { 
          error: 'Firebase Admin SDK is not configured',
          message: 'Please set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY environment variables in your .env.local file. See https://firebase.google.com/docs/admin/setup for instructions.',
          suggestion: 'You can get these credentials from Firebase Console > Project Settings > Service Accounts'
        },
        { status: 500 }
      );
    }
    
    const body = await request.json();
    const { userId, email } = body;

    let targetUserId = userId;

    // If email provided, find user by email
    if (!targetUserId && email) {
      const usersQuery = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
      if (!usersQuery.empty) {
        targetUserId = usersQuery.docs[0].id;
        console.log('✅ Found user by email:', email, '->', targetUserId);
      } else {
        // Try to find by Firebase Auth
        try {
          const users = await auth.listUsers();
          const firebaseUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
          if (firebaseUser) {
            targetUserId = firebaseUser.uid;
            console.log('✅ Found user in Firebase Auth:', email, '->', targetUserId);
          }
        } catch (e) {
          console.error('Error searching Firebase Auth:', e);
        }
      }
    }

    // If still no userId, try to get from auth token
    if (!targetUserId) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split('Bearer ')[1];
          const decodedToken = await auth.verifyIdToken(token);
          targetUserId = decodedToken.uid;
          console.log('✅ Using authenticated user:', targetUserId);
        } catch (e) {
          console.error('Error verifying token:', e);
        }
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'userId or email is required, or you must be authenticated' },
        { status: 400 }
      );
    }

    // Get user document first to verify it exists
    let userDoc = await db.collection('users').doc(targetUserId).get();

    // If not found, try to find by uid field
    if (!userDoc.exists) {
      const usersQuery = await db.collection('users').where('uid', '==', targetUserId).limit(1).get();
      if (!usersQuery.empty) {
        userDoc = usersQuery.docs[0];
        targetUserId = userDoc.id; // Use the actual document ID
        console.log('✅ Found user by uid field:', targetUserId);
      }
    }

    // If still not found, create the user document
    if (!userDoc.exists) {
      console.log('⚠️ User document not found, creating it...');
      try {
        const firebaseUser = await auth.getUser(targetUserId);
        const newUserData = {
          uid: targetUserId,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          role: 'employee',
          status: 'active',
          isPlatformAdmin: true, // Set as platform admin
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await db.collection('users').doc(targetUserId).set(newUserData);
        userDoc = await db.collection('users').doc(targetUserId).get();
        console.log('✅ Created user document with platform admin access');
      } catch (createError) {
        console.error('❌ Failed to create user document:', createError);
        return NextResponse.json(
          { error: 'User not found and could not be created' },
          { status: 404 }
        );
      }
    }

    const userData = userDoc.data();

    // Update user to be platform admin
    await db.collection('users').doc(targetUserId).update({
      isPlatformAdmin: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully set ${userData?.name || 'User'} (${userData?.email || email || targetUserId}) as platform admin`,
      user: {
        id: targetUserId,
        name: userData?.name,
        email: userData?.email,
        isPlatformAdmin: true,
      },
    });
  } catch (error) {
    console.error('Error setting platform admin:', error);
    return NextResponse.json(
      {
        error: 'Failed to set platform admin',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

