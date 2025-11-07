'use client';

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  setDoc,
  updateDoc, 
  query, 
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import type { User } from '@/types';

const USERS_COLLECTION = 'users';

// Test Firebase connection
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    console.log('Testing Firebase connection...');
    // Use a simpler test - just try to get the users collection
    const usersSnapshot = await getDocs(collection(db, USERS_COLLECTION));
    console.log('Firebase connection successful, users collection accessible');
    return true;
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return false;
  }
}

// Initialize default users in Firestore
export async function initializeDefaultUsers(): Promise<void> {
  try {
    const usersSnapshot = await getDocs(collection(db, USERS_COLLECTION));
    
    // Only initialize if no users exist
    if (usersSnapshot.empty) {
      const now = new Date();
      
      // Create admin first
      const adminRef = await addDoc(collection(db, USERS_COLLECTION), {
        uid: 'admin-001',
        name: 'Alex Admin',
        email: 'admin@corp.com',
        role: 'admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      // Create manager and get their document ID
      const managerRef = await addDoc(collection(db, USERS_COLLECTION), {
        uid: 'manager-001',
        name: 'Bob Manager',
        email: 'manager@example.com',
        role: 'manager',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      // Create employees with the actual manager document ID
      const employees = [
        {
          uid: 'employee-001',
          name: 'Charlie Employee',
          email: 'employee@example.com',
          role: 'employee',
          supervisorId: managerRef.id, // Use actual document ID
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
        {
          uid: 'employee-002',
          name: 'Dana Employee',
          email: 'employee2@example.com',
          role: 'employee',
          supervisorId: managerRef.id, // Use actual document ID
          status: 'active',
          createdAt: now,
          updatedAt: now,
        }
      ];

      for (const employee of employees) {
        await addDoc(collection(db, USERS_COLLECTION), employee);
      }
      console.log('Default users initialized in Firestore with proper relationships');
    }
  } catch (error) {
    console.error('Error initializing default users:', error);
  }
}

export async function getUsers(companyId?: string): Promise<User[]> {
  try {
    let q;
    if (companyId) {
      q = query(
        collection(db, USERS_COLLECTION),
        where('companyId', '==', companyId)
      );
    } else {
      q = collection(db, USERS_COLLECTION);
    }
    
    const querySnapshot = await getDocs(q);
    const users: User[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        uid: data.uid || doc.id,
        name: data.name,
        email: data.email,
        role: data.role,
        companyId: data.companyId,
        isCompanyOwner: data.isCompanyOwner,
        canManageSubscription: data.canManageSubscription,
        isPlatformAdmin: data.isPlatformAdmin,
        status: data.status,
        supervisorId: data.supervisorId,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
}

export async function getUserById(userId: string): Promise<User | undefined> {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    
    if (!userDoc.exists()) {
      return undefined;
    }

    const data = userDoc.data();
    return {
      id: userDoc.id,
      uid: data.uid || userDoc.id,
      name: data.name,
      email: data.email,
      role: data.role,
      status: data.status,
      companyId: data.companyId,
      isCompanyOwner: data.isCompanyOwner,
      canManageSubscription: data.canManageSubscription,
      isPlatformAdmin: data.isPlatformAdmin,
      supervisorId: data.supervisorId,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
    };
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return undefined;
  }
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('email', '==', email.toLowerCase())
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid || doc.id,
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status,
        companyId: data.companyId,
        isCompanyOwner: data.isCompanyOwner,
        canManageSubscription: data.canManageSubscription,
        isPlatformAdmin: data.isPlatformAdmin,
        supervisorId: data.supervisorId,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
      };
    }
    return undefined;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return undefined;
  }
}

export async function addUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    // Validate required fields
    if (!user.name || !user.email || !user.role) {
      throw new Error('Missing required fields: name, email, and role are required');
    }

    // Clean and validate the data
    const now = new Date();
    const userData: any = {
      uid: user.uid || '', // Will be set when user is created via Firebase Auth
      name: user.name.trim(),
      email: user.email.toLowerCase().trim(),
      role: user.role,
      status: user.status || 'active',
      supervisorId: user.supervisorId || null,
      createdAt: now,
      updatedAt: now,
    };

    // Include company-related fields if provided
    if (user.companyId !== undefined) {
      userData.companyId = user.companyId;
    }
    if (user.isCompanyOwner !== undefined) {
      userData.isCompanyOwner = user.isCompanyOwner;
    }
    if (user.canManageSubscription !== undefined) {
      userData.canManageSubscription = user.canManageSubscription;
    }
    if (user.isPlatformAdmin !== undefined) {
      userData.isPlatformAdmin = user.isPlatformAdmin;
    }

    // Remove any undefined or null values that might cause issues (but keep companyId even if null for filtering)
    const cleanUserData = Object.fromEntries(
      Object.entries(userData).filter(([key, value]) => {
        // Keep companyId even if null/undefined for proper filtering
        if (key === 'companyId') return true;
        return value !== undefined && value !== null;
      })
    );
    
    console.log('Adding user to Firestore with data:', {
      name: cleanUserData.name,
      email: cleanUserData.email,
      role: cleanUserData.role,
      companyId: cleanUserData.companyId,
      status: cleanUserData.status,
      uid: cleanUserData.uid,
    });
    
    // If UID is provided, use it as the document ID (for Firebase Auth users)
    // Otherwise, generate a new document ID
    let userId: string;
    if (cleanUserData.uid) {
      userId = cleanUserData.uid;
      const userRef = doc(db, USERS_COLLECTION, userId);
      await setDoc(userRef, cleanUserData);
      console.log('User added successfully with UID as document ID:', userId);
    } else {
      const docRef = await addDoc(collection(db, USERS_COLLECTION), cleanUserData);
      userId = docRef.id;
      console.log('User added successfully with generated ID:', userId);
    }
    
    return userId;
  } catch (error) {
    console.error('Error adding user to Firestore:', error);
    console.error('User data that caused error:', user);
    throw error;
  }
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: new Date(),
    });
    console.log('User updated successfully');
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

export async function getManagers(companyId?: string): Promise<User[]> {
  try {
    let q;
    if (companyId) {
      q = query(
        collection(db, USERS_COLLECTION),
        where('companyId', '==', companyId),
        where('role', '==', 'manager'),
        where('status', '==', 'active')
      );
    } else {
      q = query(
        collection(db, USERS_COLLECTION),
        where('role', '==', 'manager'),
        where('status', '==', 'active')
      );
    }
    
    const querySnapshot = await getDocs(q);
    const managers: User[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      managers.push({
        id: doc.id,
        uid: data.uid || doc.id,
        name: data.name,
        email: data.email,
        role: data.role,
        companyId: data.companyId,
        isCompanyOwner: data.isCompanyOwner,
        canManageSubscription: data.canManageSubscription,
        isPlatformAdmin: data.isPlatformAdmin,
        status: data.status,
        supervisorId: data.supervisorId,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
      });
    });
    
    return managers;
  } catch (error) {
    console.error('Error getting managers:', error);
    return [];
  }
}

export async function getEmployeesForManager(managerId: string): Promise<User[]> {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('role', '==', 'employee'),
      where('supervisorId', '==', managerId),
      where('status', '==', 'active')
    );
    const querySnapshot = await getDocs(q);
    const employees: User[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      employees.push({
        id: doc.id,
        uid: data.uid || doc.id,
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status,
        supervisorId: data.supervisorId,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
      });
    });
    
    return employees;
  } catch (error) {
    console.error('Error getting employees for manager:', error);
    return [];
  }
}

export async function updateUserSupervisor(userId: string, newSupervisorId: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      supervisorId: newSupervisorId,
      updatedAt: new Date(),
    });
    console.log('User supervisor updated successfully');
  } catch (error) {
    console.error('Error updating user supervisor:', error);
    throw error;
  }
}

// Real-time listener for users (disabled for now to avoid errors)
export function subscribeToUsers(callback: (users: User[]) => void): () => void {
  // For now, just return a no-op function to avoid real-time listener errors
  // We can re-enable this later when we have better error handling
  console.log('Real-time listener disabled to avoid Firestore errors');
  return () => {};
}