import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface AISettings {
  geminiApiKey: string;
  geminiModel: string;
  updatedAt: any;
  updatedBy: string;
}

const SETTINGS_DOC_ID = 'ai_settings';

/**
 * Get AI settings from Firestore (client-side)
 * Returns null if settings don't exist
 */
export async function getAISettings(): Promise<AISettings | null> {
  try {
    const settingsRef = doc(db, 'platform_settings', SETTINGS_DOC_ID);
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      return settingsSnap.data() as AISettings;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting AI settings:', error);
    throw error;
  }
}

/**
 * Get AI settings from Firestore using Admin SDK (server-side)
 * Returns null if settings don't exist
 */
export async function getAISettingsAdmin(): Promise<AISettings | null> {
  try {
    const { db: adminDb } = await import('./firebase-admin');
    if (!adminDb) {
      throw new Error('Firebase Admin SDK not initialized');
    }
    const settingsDoc = await adminDb.collection('platform_settings').doc(SETTINGS_DOC_ID).get();
    
    if (settingsDoc.exists) {
      return settingsDoc.data() as AISettings;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting AI settings (admin):', error);
    throw error;
  }
}

/**
 * Update AI settings in Firestore (client-side)
 * Only platform admins should call this
 */
export async function updateAISettings(
  settings: Partial<AISettings>,
  updatedBy: string
): Promise<void> {
  try {
    const settingsRef = doc(db, 'platform_settings', SETTINGS_DOC_ID);
    const existingSettings = await getAISettings();
    
    await setDoc(
      settingsRef,
      {
        ...existingSettings,
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy,
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating AI settings:', error);
    throw error;
  }
}

/**
 * Update AI settings in Firestore using Admin SDK (server-side)
 * Only platform admins should call this
 * To clear a setting and use env var, pass null for that field
 */
export async function updateAISettingsAdmin(
  settings: Partial<AISettings & { geminiApiKey?: string | null; geminiModel?: string | null }>,
  updatedBy: string
): Promise<void> {
  try {
    const { db: adminDb } = await import('./firebase-admin');
    if (!adminDb) {
      throw new Error('Firebase Admin SDK not initialized');
    }
    const { FieldValue } = await import('firebase-admin/firestore');
    const settingsRef = adminDb.collection('platform_settings').doc(SETTINGS_DOC_ID);
    const existingSettings = await getAISettingsAdmin();
    
    // Build update object
    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy,
    };
    
    // Handle each setting field
    if ('geminiApiKey' in settings) {
      if (settings.geminiApiKey === null || settings.geminiApiKey === undefined || settings.geminiApiKey === '') {
        // Delete the field to use env var
        updateData.geminiApiKey = FieldValue.delete();
      } else {
        updateData.geminiApiKey = settings.geminiApiKey;
      }
    } else if (existingSettings?.geminiApiKey) {
      // Keep existing value if not being updated
      updateData.geminiApiKey = existingSettings.geminiApiKey;
    }
    
    if ('geminiModel' in settings) {
      if (settings.geminiModel === null || settings.geminiModel === undefined || settings.geminiModel === '') {
        // Delete the field to use env var
        updateData.geminiModel = FieldValue.delete();
      } else {
        updateData.geminiModel = settings.geminiModel;
      }
    } else if (existingSettings?.geminiModel) {
      // Keep existing value if not being updated
      updateData.geminiModel = existingSettings.geminiModel;
    }
    
    await settingsRef.set(updateData, { merge: true });
  } catch (error) {
    console.error('Error updating AI settings (admin):', error);
    throw error;
  }
}

/**
 * Get available Gemini models
 */
export function getAvailableModels(): string[] {
  return [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-2.5-flash-lite-preview-06-17',
    'gemini-2.5-pro-preview-06-05',
    'gemini-2.5-pro-preview-03-25',
  ];
}

