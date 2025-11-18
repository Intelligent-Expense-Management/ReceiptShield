import { NextRequest } from 'next/server';

export interface MonitoringUser {
  id: string;
  role: 'admin' | 'manager' | 'employee';
  email: string;
  name: string;
}

export async function getMonitoringUser(request: NextRequest): Promise<MonitoringUser | null> {
  try {
    // In a real implementation, you would:
    // 1. Extract JWT token from Authorization header
    // 2. Verify the token with your auth service
    // 3. Check if user has monitoring permissions
    // 4. Return user data if authorized

    // For now, we'll use a simple header-based auth for demo
    const authHeader = request.headers.get('authorization');
    const apiKey = request.headers.get('x-monitoring-key');
    
    // Check for monitoring API key (for server-to-server calls)
    if (apiKey === process.env.MONITORING_API_KEY) {
      return {
        id: 'system',
        role: 'admin',
        email: 'system@receiptshield.com',
        name: 'System Monitor'
      };
    }

    // Check for Bearer token (for user authentication)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Verify Firebase ID token
        const { auth } = await import('./firebase-admin');
        if (!auth) {
          console.error('Firebase Admin SDK not initialized');
          return null;
        }
        const decodedToken = await auth.verifyIdToken(token);
        return {
          id: decodedToken.uid,
          role: (decodedToken.role as 'admin' | 'manager' | 'employee') || 'employee',
          email: decodedToken.email || 'unknown@receiptshield.com',
          name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
        };
      } catch (error) {
        console.error('Failed to verify monitoring auth token:', error);
        return null; // Invalid token
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to get monitoring user:', error);
    return null;
  }
}

export async function requireMonitoringAuth(request: NextRequest): Promise<MonitoringUser> {
  const user = await getMonitoringUser(request);
  if (!user) {
    throw new Error('Unauthorized: Monitoring access required');
  }
  return user;
}

export async function requireAdminAccess(request: NextRequest): Promise<MonitoringUser> {
  const user = await requireMonitoringAuth(request);
  if (user.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }
  return user;
}

export function logMonitoringAccess(user: MonitoringUser, endpoint: string, action: string) {
  console.log(`[Monitoring Access] User: ${user.email} (${user.role}) accessed ${endpoint} - ${action}`);
}
