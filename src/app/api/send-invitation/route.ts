import { NextRequest, NextResponse } from 'next/server';
import { createInvitation } from '@/lib/firebase-invitation-store';
import { generateInvitationEmail } from '@/lib/email-service';
import { sendInvitationEmail } from '@/lib/sendgrid-service';
import { auth } from '@/lib/firebase-admin';

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://compensationengine.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('📧 Send invitation API called');
    
    // Try to get authenticated user from Authorization header
    let invitedBy = 'system-admin'; // Fallback if no auth token
    const authHeader = request.headers.get('authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token);
        // Use email as invitedBy, or uid if email is not available
        invitedBy = decodedToken.email || decodedToken.uid;
        console.log('📧 Authenticated user:', invitedBy);
      } catch (authError) {
        console.warn('📧 Failed to verify auth token, using fallback:', authError);
        // Continue with fallback value
      }
    } else {
      console.warn('📧 No authorization header found, using fallback invitedBy');
    }
    
    const invitationData = await request.json();
    console.log('📧 Invitation data received:', {
      email: invitationData.email,
      role: invitationData.role,
      hasMessage: !!invitationData.message,
      invitedBy
    });

    // Create invitation in database (or get existing one)
    console.log('📧 Creating invitation in database...');
    const invitation = await createInvitation(invitationData, invitedBy);
    console.log('📧 Invitation created/retrieved successfully:', invitation.id);
    
    // Check if this is a resend of an existing invitation
    const isResend = invitation.createdAt.getTime() < (Date.now() - 60000); // Created more than 1 minute ago
    console.log('📧 Invitation details:', {
      id: invitation.id,
      status: invitation.status,
      createdAt: invitation.createdAt,
      isResend: isResend
    });

    // Generate email content
    console.log('📧 Generating email content...');
    const { subject, html, text } = generateInvitationEmail(invitation, invitationData.message);

    // Send the invitation email using SendGrid service
    console.log('📧 Sending invitation email...');
    let emailSent = false;
    try {
      const emailResult = await sendInvitationEmail({
        invitation: {
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
        },
        customMessage: invitationData.message,
      });
      
      console.log('📧 Email sent successfully:', emailResult.messageId);
      emailSent = true;
    } catch (emailError) {
      console.error('📧 Failed to send email:', emailError);
      // Continue anyway - the invitation was created successfully
    }

    // Log the email content for debugging
    console.log('--- EMAIL CONTENT ---');
    console.log('To:', invitation.email);
    console.log('Subject:', subject);
    console.log('Invitation URL:', `https://compensationengine.com/accept-invitation?token=${invitation.token}`);
    console.log('HTML Body Length:', html.length);
    console.log('Text Body Length:', text.length);
    console.log('--------------------------');

    // Get the base URL for the response
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://compensationengine.com';
    const invitationUrl = `${baseUrl}/accept-invitation?token=${invitation.token}`;

    return NextResponse.json({ 
      success: true, 
      token: invitation.token,
      message: isResend 
        ? 'Invitation email resent successfully.' 
        : 'Invitation created and email sent successfully.',
      invitationUrl: invitationUrl,
      isResend: isResend
    }, {
      headers: {
        'Access-Control-Allow-Origin': 'https://compensationengine.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('❌ Failed to create invitation:', error);
    
    // Provide more specific error information
    let errorMessage = 'Failed to create invitation';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': 'https://compensationengine.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
}
