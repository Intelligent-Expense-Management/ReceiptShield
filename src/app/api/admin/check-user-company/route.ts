import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK not initialized' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Get user by email
    const usersRef = db.collection('users');
    const userQuery = await usersRef.where('email', '==', email.toLowerCase()).get();

    if (userQuery.empty) {
      return NextResponse.json(
        { 
          found: false,
          message: `User not found with email: ${email}` 
        },
        { status: 404 }
      );
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    
    // Get company information if user has a companyId
    let company = null;
    if (userData.companyId) {
      const companyRef = db.collection('companies').doc(userData.companyId);
      const companyDoc = await companyRef.get();
      
      if (companyDoc.exists) {
        const companyData = companyDoc.data();
        company = {
          id: companyDoc.id,
          name: companyData?.name,
          ownerId: companyData?.ownerId,
          subscriptionTier: companyData?.subscriptionTier,
          subscriptionStatus: companyData?.subscriptionStatus,
          trialEndsAt: companyData?.trialEndsAt?.toDate?.() || companyData?.trialEndsAt,
          currentPeriodEnd: companyData?.currentPeriodEnd?.toDate?.() || companyData?.currentPeriodEnd,
          receiptCount: companyData?.receiptCount || 0,
          userCount: companyData?.userCount || 0,
        };
      }
    }

    return NextResponse.json({
      found: true,
      user: {
        id: userDoc.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        status: userData.status,
        companyId: userData.companyId,
        isCompanyOwner: userData.isCompanyOwner || false,
        canManageSubscription: userData.canManageSubscription || false,
        isPlatformAdmin: userData.isPlatformAdmin || false,
      },
      company: company,
      summary: company 
        ? `${userData.name} (${email}) belongs to "${company.name}"`
        : `${userData.name} (${email}) is not associated with any company`
    });
  } catch (error) {
    console.error('Error checking user company:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check user company',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

