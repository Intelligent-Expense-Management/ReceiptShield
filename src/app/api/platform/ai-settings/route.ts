import { NextRequest, NextResponse } from 'next/server';
import { getAISettingsAdmin, updateAISettingsAdmin, getAvailableModels } from '@/lib/firebase-ai-settings-store';
import { db, auth, isAdminInitialized } from '@/lib/firebase-admin';

/**
 * Helper to get user from request
 * First tries to verify Firebase Auth token, then falls back to user ID header
 */
async function getAuthenticatedUser(request: NextRequest) {
  // Check if Admin SDK is initialized
  if (!isAdminInitialized || !auth || !db) {
    console.error('❌ Firebase Admin SDK not initialized. Cannot verify tokens or access Firestore.');
    throw new Error('Firebase Admin SDK is not configured. Please set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY environment variables.');
  }
  
  // Try to get Firebase Auth token first (more secure)
  const authHeader = request.headers.get('authorization');
  let userId: string | null = null;
  let verifiedViaToken = false;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;
      verifiedViaToken = true;
      console.log('✅ User authenticated via Firebase token:', userId);
    } catch (error) {
      console.warn('⚠️ Firebase token verification failed:', error);
      // If it's a credential error, provide helpful message
      if (error instanceof Error && error.message.includes('default credentials')) {
        throw new Error('Firebase Admin SDK credentials not configured. Please set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in your environment variables.');
      }
    }
  }
  
  // Fallback to user ID header if no token
  if (!userId) {
    userId = request.headers.get('x-user-id');
    if (userId) {
      console.log('📋 Using user ID from header:', userId);
    }
  }
  
  if (!userId) {
    console.warn('⚠️ No user ID or auth token in request headers');
    return null;
  }
  
  try {
    console.log('🔍 Looking up user in Firestore:', userId);
    
    // Try to get user by document ID first (most common case)
    let userDoc = await db.collection('users').doc(userId).get();
    
    // If not found, try searching by uid field
    if (!userDoc.exists) {
      console.log('⚠️ User not found by doc ID, searching by uid field...');
      const usersQuery = await db.collection('users').where('uid', '==', userId).limit(1).get();
      if (!usersQuery.empty) {
        userDoc = usersQuery.docs[0];
        console.log('✅ User found by uid field');
      }
    }
    
    // If still not found but we verified via token, create/update user record
    if (!userDoc.exists && verifiedViaToken) {
      console.log('⚠️ User verified via token but not in Firestore, creating/updating record...');
      try {
        const tokenData = await auth.getUser(userId);
        console.log('📋 Token data:', {
          uid: tokenData.uid,
          email: tokenData.email,
          displayName: tokenData.displayName,
        });
        
        // Check if user exists in Firestore by email as fallback
        let existingUser = null;
        if (tokenData.email) {
          const emailQuery = await db.collection('users').where('email', '==', tokenData.email.toLowerCase()).limit(1).get();
          if (!emailQuery.empty) {
            existingUser = emailQuery.docs[0];
            console.log('✅ Found user by email, will update document:', existingUser.id);
          }
        }
        
        const userData: any = {
          uid: userId, // Always use the Firebase Auth UID
          email: tokenData.email || '',
          name: tokenData.displayName || tokenData.email?.split('@')[0] || 'User',
          role: existingUser?.data()?.role || 'employee',
          status: existingUser?.data()?.status || 'active',
          isPlatformAdmin: existingUser?.data()?.isPlatformAdmin || false,
          companyId: existingUser?.data()?.companyId,
          isCompanyOwner: existingUser?.data()?.isCompanyOwner || false,
          canManageSubscription: existingUser?.data()?.canManageSubscription || false,
          supervisorId: existingUser?.data()?.supervisorId,
          updatedAt: new Date(),
        };
        
        // Add createdAt only if it doesn't exist
        if (existingUser?.data()?.createdAt) {
          userData.createdAt = existingUser.data().createdAt;
        } else {
          userData.createdAt = new Date();
        }
        
        // Always use userId (Firebase Auth UID) as the document ID
        // This ensures consistency with how Firebase Auth works
        const docId = userId;
        console.log('📝 Creating/updating user document with ID:', docId);
        
        await db.collection('users').doc(docId).set(userData, { merge: true });
        
        // Verify the document was created
        userDoc = await db.collection('users').doc(docId).get();
        if (userDoc.exists) {
          console.log('✅ Successfully created/updated user record in Firestore:', {
            docId: userDoc.id,
            email: userDoc.data()?.email,
            isPlatformAdmin: userDoc.data()?.isPlatformAdmin,
          });
        } else {
          console.error('❌ User document still does not exist after creation attempt');
          throw new Error('Failed to create user document');
        }
      } catch (createError) {
        console.error('❌ Failed to create user record:', createError);
        console.error('   Error details:', {
          message: createError instanceof Error ? createError.message : String(createError),
          stack: createError instanceof Error ? createError.stack : undefined,
        });
        // If we verified via token, still allow access but with limited info
        if (verifiedViaToken) {
          console.log('⚠️ Allowing access based on verified token only');
          const tokenData = await auth.getUser(userId).catch(() => null);
          return {
            id: userId,
            uid: userId,
            name: tokenData?.displayName || tokenData?.email?.split('@')[0] || 'User',
            email: tokenData?.email || '',
            role: 'employee',
            isPlatformAdmin: false, // Will need to be set in Firestore
          };
        }
      }
    }
    
    // If still not found, log all users to help debug (only in dev)
    if (!userDoc.exists) {
      console.error('❌ User document not found in Firestore');
      console.error('   Searched for userId:', userId);
      console.error('   Tried: document ID, uid field, and email');
      console.error('   Verified via token:', verifiedViaToken);
      
      // In development, list some users to help debug
      if (process.env.NODE_ENV === 'development') {
        try {
          const allUsers = await db.collection('users').limit(5).get();
          console.log('   Sample users in Firestore:');
          allUsers.forEach(doc => {
            const data = doc.data();
            console.log(`     - Doc ID: ${doc.id}, UID: ${data?.uid}, Email: ${data?.email}`);
          });
        } catch (e) {
          console.error('   Could not list users:', e);
        }
      }
      
      // If verified via token, allow access with limited permissions
      if (verifiedViaToken) {
        console.log('⚠️ Allowing limited access based on verified token');
        try {
          const tokenData = await auth.getUser(userId);
          return {
            id: userId,
            uid: userId,
            name: tokenData.displayName || tokenData.email?.split('@')[0] || 'User',
            email: tokenData.email || '',
            role: 'employee',
            isPlatformAdmin: false, // User will need to set this in Firestore manually
          };
        } catch (e) {
          console.error('❌ Could not get user from token:', e);
        }
      }
      
      return null;
    }
    
    const data = userDoc.data();
    console.log('✅ User found in Firestore:', {
      docId: userDoc.id,
      uid: data?.uid,
      email: data?.email,
      isPlatformAdmin: data?.isPlatformAdmin,
    });
    
    return {
      id: userDoc.id,
      uid: data?.uid || userDoc.id,
      name: data?.name,
      email: data?.email,
      role: data?.role,
      isPlatformAdmin: data?.isPlatformAdmin || false,
    };
  } catch (error) {
    console.error('❌ Error getting user from Firestore:', error);
    return null;
  }
}

/**
 * GET /api/platform/ai-settings
 * Get current AI settings (platform admin only)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📥 GET /api/platform/ai-settings - Request received');
    
    // Log request headers for debugging
    const authHeader = request.headers.get('authorization');
    const userIdHeader = request.headers.get('x-user-id');
    console.log('📋 Request headers:', {
      hasAuthHeader: !!authHeader,
      hasUserIdHeader: !!userIdHeader,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 30) + '...' : null,
      userIdHeader: userIdHeader,
    });
    
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      console.error('❌ Unauthorized - User not found or lookup failed');
      
      // Try to get more info about what went wrong
      const authHeader = request.headers.get('authorization');
      const userIdHeader = request.headers.get('x-user-id');
      
      let debugInfo: any = {
        hasAuthHeader: !!authHeader,
        hasUserIdHeader: !!userIdHeader,
        authHeaderPrefix: authHeader ? authHeader.substring(0, 20) + '...' : null,
        userIdHeader: userIdHeader || null,
        timestamp: new Date().toISOString(),
        requestMethod: 'GET',
        requestPath: '/api/platform/ai-settings',
      };
      
      // Try to verify token if present
      if (authHeader && authHeader.startsWith('Bearer ') && auth && db) {
        try {
          const token = authHeader.split('Bearer ')[1];
          const decodedToken = await auth.verifyIdToken(token);
          debugInfo.tokenInfo = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified,
          };
          
          // Check if user exists in Firestore by this UID
          const userDoc = await db.collection('users').doc(decodedToken.uid).get();
          debugInfo.userDocExists = userDoc.exists;
          
          if (!userDoc.exists) {
            // Try to find by email
            if (decodedToken.email) {
              const emailQuery = await db.collection('users').where('email', '==', decodedToken.email.toLowerCase()).limit(1).get();
              debugInfo.foundByEmail = !emailQuery.empty;
              if (!emailQuery.empty) {
                debugInfo.emailDocId = emailQuery.docs[0].id;
                debugInfo.emailDocData = {
                  uid: emailQuery.docs[0].data()?.uid,
                  email: emailQuery.docs[0].data()?.email,
                };
              }
            }
          }
        } catch (tokenError) {
          debugInfo.tokenError = tokenError instanceof Error ? tokenError.message : 'Unknown error';
        }
      }
      
      // Always include debug info in development, even if empty
      const responseData: any = {
        error: 'Unauthorized - User not found. Please ensure you are logged in and your user exists in Firestore.',
        suggestion: 'If you are logged in, your user document may not exist in Firestore. Please contact support or use the set-platform-admin script to create your user document.',
        debug: debugInfo, // Always include debug info in development
      };
      
      // Log debug info to server console
      console.log('🔍 Debug info being sent:', JSON.stringify(debugInfo, null, 2));
      console.log('📤 Full response data:', JSON.stringify(responseData, null, 2));
      
      return NextResponse.json(responseData, { status: 401 });
    }

    console.log('✅ User authenticated:', {
      id: user.id,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
    });

    if (!user.isPlatformAdmin) {
      console.warn('⚠️ Forbidden - User is not a platform admin');
      return NextResponse.json(
        { error: 'Forbidden - Platform admin access required' },
        { status: 403 }
      );
    }

    console.log('📋 Loading AI settings from Firestore...');
    const settings = await getAISettingsAdmin();
    const availableModels = getAvailableModels();

    // Get environment variable values for comparison
    const envSettings = {
      geminiApiKey: process.env.GOOGLE_AI_API_KEY || 
                    process.env.GEMINI_API_KEY ||
                    process.env.GOOGLE_API_KEY || 
                    null,
      geminiModel: process.env.GEMINI_MODEL || null,
    };

    // Determine which source is being used
    const activeSource = {
      apiKey: settings?.geminiApiKey ? 'firestore' : (envSettings.geminiApiKey ? 'environment' : 'none'),
      model: settings?.geminiModel ? 'firestore' : (envSettings.geminiModel ? 'environment' : 'default'),
    };

    console.log('✅ Settings loaded successfully');

    return NextResponse.json({
      settings: settings || null,
      envSettings: {
        geminiApiKey: envSettings.geminiApiKey ? `${envSettings.geminiApiKey.substring(0, 10)}...` : null,
        geminiModel: envSettings.geminiModel,
      },
      activeSource,
      availableModels,
    });
  } catch (error) {
    console.error('❌ Error getting AI settings:', error);
    
    // Provide debug info even for unexpected errors
    const authHeader = request.headers.get('authorization');
    const userIdHeader = request.headers.get('x-user-id');
    let debugInfo: any = {
      hasAuthHeader: !!authHeader,
      hasUserIdHeader: !!userIdHeader,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
    
    // Try to verify token if present
    if (authHeader && authHeader.startsWith('Bearer ') && auth) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token);
        debugInfo.tokenInfo = {
          uid: decodedToken.uid,
          email: decodedToken.email,
        };
      } catch (tokenError) {
        debugInfo.tokenError = tokenError instanceof Error ? tokenError.message : 'Unknown error';
      }
    }
    
    return NextResponse.json(
      {
        error: 'Failed to get AI settings',
        details: error instanceof Error ? error.message : 'Unknown error',
        debug: process.env.NODE_ENV === 'development' ? debugInfo : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/platform/ai-settings
 * Update AI settings (platform admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const { geminiApiKey, geminiModel } = await request.json();
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!user.isPlatformAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Platform admin access required' },
        { status: 403 }
      );
    }

    // Validate inputs
    // Allow empty API key to clear Firestore setting and use env var
    // Allow empty model to clear Firestore setting and use env var
    
    // Update settings
    const updateData: any = {};
    
    if (geminiApiKey !== undefined) {
      if (geminiApiKey.trim() === '') {
        // Clear the setting to use env var
        updateData.geminiApiKey = null;
      } else {
        updateData.geminiApiKey = geminiApiKey.trim();
      }
    }
    
    if (geminiModel !== undefined) {
      if (geminiModel.trim() === '') {
        // Clear the setting to use env var
        updateData.geminiModel = null;
      } else {
        updateData.geminiModel = geminiModel.trim();
      }
    }
    
    // If both are undefined, nothing to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No settings to update' },
        { status: 400 }
      );
    }

    await updateAISettingsAdmin(updateData, user.id);

    return NextResponse.json({
      success: true,
      message: 'AI settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    return NextResponse.json(
      { error: 'Failed to update AI settings' },
      { status: 500 }
    );
  }
}

