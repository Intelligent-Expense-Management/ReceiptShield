import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const INVITATIONS_COLLECTION = 'invitations';
const USERS_COLLECTION = 'users';

export async function POST(request: NextRequest) {
  try {
    const { email, companyId, role } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get the user by email (server-side query)
    const userQuery = query(
      collection(db, USERS_COLLECTION),
      where('email', '==', email.toLowerCase())
    );
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const user = {
      id: userDoc.id,
      uid: userData.uid || userDoc.id,
      email: userData.email,
      companyId: userData.companyId,
      role: userData.role,
    };

    // Try to find invitation data (check accepted first, then any status)
    let invitationData: any = null;
    
    // First, try to find accepted invitation
    let invitationQuery = query(
      collection(db, INVITATIONS_COLLECTION),
      where('email', '==', email.toLowerCase()),
      where('status', '==', 'accepted')
    );
    let invitationSnapshot = await getDocs(invitationQuery);

    // If no accepted invitation, try any invitation for this email
    if (invitationSnapshot.empty) {
      invitationQuery = query(
        collection(db, INVITATIONS_COLLECTION),
        where('email', '==', email.toLowerCase())
      );
      invitationSnapshot = await getDocs(invitationQuery);
    }

    if (!invitationSnapshot.empty) {
      const invitationDoc = invitationSnapshot.docs[0];
      invitationData = invitationDoc.data();
    }

    // Prepare updates - use provided values or fall back to invitation data
    const updates: any = {
      updatedAt: new Date(),
    };

    // Set companyId (from parameter, invitation, or inviting user)
    if (companyId) {
      updates.companyId = companyId;
    } else if (invitationData?.companyId) {
      updates.companyId = invitationData.companyId;
    } else if (invitationData?.invitedBy) {
      // Try to get companyId from the inviting user (server-side query)
      try {
        const invitingUserRef = doc(db, USERS_COLLECTION, invitationData.invitedBy);
        const invitingUserDoc = await getDoc(invitingUserRef);
        if (invitingUserDoc.exists()) {
          const invitingUserData = invitingUserDoc.data();
          if (invitingUserData.companyId) {
            updates.companyId = invitingUserData.companyId;
          }
        }
      } catch (error) {
        console.error('Error getting inviting user:', error);
        // Continue without companyId from inviting user
      }
    }

    // Set role (from parameter or invitation)
    if (role) {
      updates.role = role;
    } else if (invitationData?.role) {
      updates.role = invitationData.role;
    }

    // Update supervisorId if it was in the invitation
    if (invitationData?.supervisorId) {
      updates.supervisorId = invitationData.supervisorId;
    }

    // Validate that we have at least companyId and role
    if (!updates.companyId && !updates.role) {
      return NextResponse.json(
        { 
          error: 'Could not determine companyId or role. Please provide them manually.',
          foundInvitation: !!invitationData,
          invitationData: invitationData ? {
            companyId: invitationData.companyId,
            role: invitationData.role,
            status: invitationData.status,
          } : null,
        },
        { status: 400 }
      );
    }

    // Update the user document
    // Try to update by UID first (if document ID matches UID)
    let userRef = doc(db, USERS_COLLECTION, user.uid);
    let updateSuccess = false;
    
    try {
      await updateDoc(userRef, updates);
      updateSuccess = true;
    } catch (error: any) {
      // If update by UID fails, try by the document ID from getUserByEmail
      if (error.code === 'not-found' || error.message?.includes('not found')) {
        userRef = doc(db, USERS_COLLECTION, user.id);
        await updateDoc(userRef, updates);
        updateSuccess = true;
      } else {
        throw error;
      }
    }

    console.log('User fixed successfully:', {
      userId: user.id,
      uid: user.uid,
      email: user.email,
      updates,
      updateMethod: updateSuccess ? 'success' : 'failed',
    });

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      updates: {
        companyId: updates.companyId,
        role: updates.role,
        supervisorId: updates.supervisorId,
      },
      foundInvitation: !!invitationData,
    });
  } catch (error: any) {
    console.error('Error fixing user from invitation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fix user' },
      { status: 500 }
    );
  }
}

