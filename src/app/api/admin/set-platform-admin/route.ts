import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

/**
 * API route to set a user as platform admin
 * For development/testing purposes
 * 
 * Usage: POST /api/admin/set-platform-admin
 * Body: { userId: "user-id-here" }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get user document first to verify it exists
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Update user to be platform admin
    await updateDoc(userRef, {
      isPlatformAdmin: true,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully set ${userData.name} (${userData.email}) as platform admin`,
      user: {
        id: userId,
        name: userData.name,
        email: userData.email,
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

