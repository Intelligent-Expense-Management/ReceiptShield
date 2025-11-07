'use client';

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

const NOTIFICATIONS_COLLECTION = 'notifications';

export interface Notification {
  id: string;
  type: "expense_approved" | "budget_alert" | "fraud_alert" | "receipt_reminder" | "system_update" | "receipt_pending" | "receipt_rejected";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: "low" | "medium" | "high";
  userId?: string;
  receiptId?: string;
  companyId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface NotificationData {
  type: Notification['type'];
  title: string;
  message: string;
  timestamp: Timestamp;
  read: boolean;
  priority: Notification['priority'];
  userId?: string;
  receiptId?: string;
  companyId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Create a notification in Firestore
 */
export async function createNotification(
  notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const now = new Date();
    const notificationData: Omit<NotificationData, 'createdAt' | 'updatedAt'> & { createdAt: Timestamp; updatedAt: Timestamp } = {
      type: notification.type,
      title: notification.title,
      message: notification.message,
      timestamp: Timestamp.fromDate(notification.timestamp),
      read: notification.read,
      priority: notification.priority,
      userId: notification.userId,
      receiptId: notification.receiptId,
      companyId: notification.companyId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };

    const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), notificationData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Get notifications for a user, optionally filtered by company
 */
export async function getNotifications(
  userId: string,
  companyId?: string,
  options?: {
    limitCount?: number;
    unreadOnly?: boolean;
  }
): Promise<Notification[]> {
  try {
    let q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );

    // Add company filter if provided
    if (companyId) {
      q = query(q, where('companyId', '==', companyId));
    }

    // Add unread filter if requested
    if (options?.unreadOnly) {
      q = query(q, where('read', '==', false));
    }

    // Add limit if provided
    if (options?.limitCount) {
      q = query(q, limit(options.limitCount));
    }

    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        title: data.title,
        message: data.message,
        timestamp: data.timestamp?.toDate() || new Date(),
        read: data.read || false,
        priority: data.priority,
        userId: data.userId,
        receiptId: data.receiptId,
        companyId: data.companyId,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as Notification;
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(
  userId: string,
  companyId?: string
): Promise<number> {
  try {
    const notifications = await getNotifications(userId, companyId, { unreadOnly: true });
    return notifications.length;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await updateDoc(notificationRef, {
      read: true,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
  userId: string,
  companyId?: string
): Promise<void> {
  try {
    const notifications = await getNotifications(userId, companyId, { unreadOnly: true });
    
    if (notifications.length === 0) {
      return;
    }

    const batch = writeBatch(db);
    const now = Timestamp.now();

    notifications.forEach(notification => {
      const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notification.id);
      batch.update(notificationRef, {
        read: true,
        updatedAt: now,
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await deleteDoc(notificationRef);
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(
  userId: string,
  companyId?: string
): Promise<void> {
  try {
    const notifications = await getNotifications(userId, companyId);
    
    if (notifications.length === 0) {
      return;
    }

    const batch = writeBatch(db);

    notifications.forEach(notification => {
      const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notification.id);
      batch.delete(notificationRef);
    });

    await batch.commit();
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    throw error;
  }
}

/**
 * Create or update a notification (useful for preventing duplicates)
 */
export async function upsertNotification(
  notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>,
  uniqueKey?: string // e.g., receiptId + type combination
): Promise<string> {
  try {
    // If uniqueKey is provided, check for existing notification
    if (uniqueKey && notification.receiptId) {
      const existingQuery = query(
        collection(db, NOTIFICATIONS_COLLECTION),
        where('userId', '==', notification.userId),
        where('receiptId', '==', notification.receiptId),
        where('type', '==', notification.type)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        // Update existing notification
        const existingDoc = existingSnapshot.docs[0];
        const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, existingDoc.id);
        
        await updateDoc(notificationRef, {
          title: notification.title,
          message: notification.message,
          timestamp: Timestamp.fromDate(notification.timestamp),
          priority: notification.priority,
          read: false, // Reset to unread when updated
          updatedAt: Timestamp.now(),
        });
        
        return existingDoc.id;
      }
    }

    // Create new notification
    return await createNotification(notification);
  } catch (error) {
    console.error('Error upserting notification:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time notifications for a user
 */
export function subscribeToNotifications(
  userId: string,
  companyId: string | undefined,
  callback: (notifications: Notification[]) => void
): () => void {
  try {
    let q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );

    if (companyId) {
      q = query(q, where('companyId', '==', companyId));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifications = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type,
            title: data.title,
            message: data.message,
            timestamp: data.timestamp?.toDate() || new Date(),
            read: data.read || false,
            priority: data.priority,
            userId: data.userId,
            receiptId: data.receiptId,
            companyId: data.companyId,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          } as Notification;
        });
        callback(notifications);
      },
      (error) => {
        console.error('Error in notifications subscription:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up notifications subscription:', error);
    return () => {}; // Return no-op unsubscribe function
  }
}

