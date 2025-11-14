'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Key, Cpu, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AISettings {
  geminiApiKey: string;
  geminiModel: string;
}

interface EnvSettings {
  geminiApiKey: string | null;
  geminiModel: string | null;
}

interface ActiveSource {
  apiKey: 'firestore' | 'environment' | 'none';
  model: 'firestore' | 'environment' | 'default';
}

export default function PlatformAISettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AISettings>({
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash',
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [originalSettings, setOriginalSettings] = useState<AISettings | null>(null);
  const [envSettings, setEnvSettings] = useState<EnvSettings>({ geminiApiKey: null, geminiModel: null });
  const [activeSource, setActiveSource] = useState<ActiveSource>({ apiKey: 'none', model: 'default' });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!user.isPlatformAdmin) {
      router.push('/platform/dashboard');
      return;
    }

    // Wait a bit to ensure user is fully loaded
    const timer = setTimeout(() => {
      loadSettings();
    }, 100);

    return () => clearTimeout(timer);
  }, [user, authLoading, router]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      if (!user?.id && !user?.uid) {
        throw new Error('User not authenticated - no user ID available');
      }

      const userId = user.id || user.uid;
      console.log('📡 Loading AI settings for user:', {
        id: user.id,
        uid: user.uid,
        email: user.email,
        isPlatformAdmin: user.isPlatformAdmin,
        usingId: userId,
      });
      
      if (!userId) {
        throw new Error('User ID not available');
      }

      // Get Firebase Auth token - wait for auth to be ready
      let authToken: string | null = null;
      
      try {
        const { auth } = await import('@/lib/firebase');
        const { onAuthStateChanged } = await import('firebase/auth');
        
        // Wait for auth state to be ready (with timeout)
        await new Promise<void>((resolve) => {
          if (auth.currentUser) {
            resolve();
            return;
          }
          
          const timeout = setTimeout(() => {
            unsubscribe();
            resolve();
          }, 3000);
          
          const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          });
        });
        
        if (auth.currentUser) {
          authToken = await auth.currentUser.getIdToken(false); // Don't force refresh
          console.log('✅ Got Firebase auth token');
        } else {
          console.warn('⚠️ No current user in Firebase auth');
        }
      } catch (error) {
        console.warn('⚠️ Could not get auth token:', error);
      }

      const headers: HeadersInit = {
        'x-user-id': userId,
      };
      
      if (authToken) {
        headers['authorization'] = `Bearer ${authToken}`;
        console.log('📤 Sending request with auth token');
      } else {
        console.warn('⚠️ Sending request without auth token (using user ID only)');
      }

      const response = await fetch('/api/platform/ai-settings', {
        headers,
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorData: any = {};
        let responseText = '';
        try {
          responseText = await response.text();
          console.log('📥 Raw response text:', responseText);
          if (responseText) {
            errorData = JSON.parse(responseText);
          }
        } catch (e) {
          console.error('Failed to parse error response:', e);
          console.error('Response text was:', responseText);
          errorData = { 
            error: `HTTP ${response.status}: ${response.statusText}`,
            rawResponse: responseText.substring(0, 500), // First 500 chars
          };
        }
        
        // Log debug info if available
        if (errorData.debug) {
          console.error('🔍 Debug info:', errorData.debug);
        }
        
        // Log full error data for debugging
        console.error('❌ Full error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
        
        // Show helpful error message
        let errorMessage = errorData.error || `Failed to load settings: ${response.status}`;
        if (errorData.suggestion) {
          errorMessage += `\n\n${errorData.suggestion}`;
        }
        
        // If user not found, provide specific guidance and offer to fix it
        if (response.status === 401 && errorData.debug) {
          const debug = errorData.debug;
          if (debug.tokenInfo) {
            if (!debug.userDocExists) {
              errorMessage = `Your account is authenticated (${debug.tokenInfo.email || debug.tokenInfo.uid}) but your user document doesn't exist in Firestore.`;
              
              // Offer to create the user document and set as platform admin
              if (debug.tokenInfo.email) {
                errorMessage += `\n\nWould you like to create your user document and set yourself as platform admin?`;
                // Store email for potential fix action
                (window as any).__fixUserDocument = {
                  email: debug.tokenInfo.email,
                  uid: debug.tokenInfo.uid,
                };
              }
              
              if (debug.foundByEmail && debug.emailDocId) {
                errorMessage += `\n\nNote: A user document was found with your email but a different document ID (${debug.emailDocId}). The system may need to update your document ID to match your Firebase Auth UID (${debug.tokenInfo.uid}).`;
              }
            } else {
              errorMessage = `Your account is authenticated (${debug.tokenInfo.email || debug.tokenInfo.uid}) but there was an issue accessing your user document. Please try refreshing the page.`;
            }
          } else if (!debug.hasAuthHeader && !debug.hasUserIdHeader) {
            errorMessage = `No authentication information was sent with the request. Please ensure you are logged in and try again.`;
          } else if (debug.tokenError) {
            errorMessage = `Authentication token is invalid or expired. Please log out and log back in. Error: ${debug.tokenError}`;
          }
        }
        
        // For 500 errors, show debug info if available
        if (response.status === 500 && errorData.debug) {
          const debug = errorData.debug;
          if (debug.errorMessage) {
            errorMessage += `\n\nTechnical details: ${debug.errorMessage}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setAvailableModels(data.availableModels || []);
      
      // Set environment variable info
      if (data.envSettings) {
        setEnvSettings(data.envSettings);
      }
      
      // Set active source info
      if (data.activeSource) {
        setActiveSource(data.activeSource);
      }

      if (data.settings) {
        setSettings({
          geminiApiKey: data.settings.geminiApiKey || '',
          geminiModel: data.settings.geminiModel || 'gemini-2.0-flash',
        });
        setOriginalSettings({
          geminiApiKey: data.settings.geminiApiKey || '',
          geminiModel: data.settings.geminiModel || 'gemini-2.0-flash',
        });
      } else {
        // No settings in Firestore, use defaults or env vars
        const defaultApiKey = data.envSettings?.geminiApiKey ? '' : '';
        const defaultModel = data.envSettings?.geminiModel || 'gemini-2.0-flash';
        
        setSettings({
          geminiApiKey: defaultApiKey,
          geminiModel: defaultModel,
        });
        setOriginalSettings(null);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load AI settings';
      
      // Check if we can auto-fix the user document issue
      const fixInfo = (window as any).__fixUserDocument;
      if (fixInfo && errorMessage.includes('user document doesn\'t exist')) {
        toast({
          title: 'User Document Not Found',
          description: `${errorMessage}\n\nClick "Fix" button in console or use: fetch('/api/admin/set-platform-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: '${fixInfo.email}' }) })`,
          variant: 'destructive',
        });
        
        // Also log a helper function to console
        console.log('%c🔧 Quick Fix Available!', 'color: #10b981; font-weight: bold; font-size: 14px;');
        console.log('Run this in the console to create your user document and set yourself as platform admin:');
        console.log(`
fetch('/api/admin/set-platform-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: '${fixInfo.email}' })
}).then(r => r.json()).then(result => {
  console.log(result);
  if (result.success) {
    console.log('✅ Success! Reloading page...');
    setTimeout(() => window.location.reload(), 1000);
  }
});
        `);
        
        // Auto-fix if in development
        if (process.env.NODE_ENV === 'development') {
          console.log('🔧 Auto-fixing in development mode...');
          fetch('/api/admin/set-platform-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: fixInfo.email }),
          })
            .then(r => r.json())
            .then(result => {
              if (result.success) {
                toast({
                  title: 'Success',
                  description: result.message || 'User document created and set as platform admin. Reloading...',
                });
                setTimeout(() => loadSettings(), 1000);
              } else {
                toast({
                  title: 'Auto-fix Failed',
                  description: result.error || 'Please use the console command to fix manually',
                  variant: 'destructive',
                });
              }
            })
            .catch(e => {
              console.error('Auto-fix error:', e);
            });
        }
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!settings.geminiApiKey.trim()) {
      toast({
        title: 'Validation Error',
        description: 'API key is required',
        variant: 'destructive',
      });
      return;
    }

    if (!settings.geminiModel.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Model name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      if (!user?.id) {
        toast({
          title: 'Error',
          description: 'User not authenticated',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/platform/ai-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          geminiApiKey: settings.geminiApiKey.trim(),
          geminiModel: settings.geminiModel.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      setOriginalSettings({ ...settings });
      toast({
        title: 'Success',
        description: 'AI settings updated successfully',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save AI settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    if (!originalSettings) return true;
    return (
      settings.geminiApiKey !== originalSettings.geminiApiKey ||
      settings.geminiModel !== originalSettings.geminiModel
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user?.isPlatformAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure Google Gemini API settings for the AI Assistant
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>
                Firestore settings override environment variables. Changes take effect immediately for all users.
                The API key is stored securely in Firestore and is only accessible to platform admins.
              </p>
              <div className="text-sm space-y-1">
                <p>
                  <strong>Current API Key Source:</strong>{' '}
                  <span className={activeSource.apiKey === 'firestore' ? 'text-green-600' : activeSource.apiKey === 'environment' ? 'text-blue-600' : 'text-gray-600'}>
                    {activeSource.apiKey === 'firestore' ? 'Firestore (Active)' : 
                     activeSource.apiKey === 'environment' ? 'Environment Variables (Active)' : 
                     'Not Configured'}
                  </span>
                </p>
                <p>
                  <strong>Current Model Source:</strong>{' '}
                  <span className={activeSource.model === 'firestore' ? 'text-green-600' : activeSource.model === 'environment' ? 'text-blue-600' : 'text-gray-600'}>
                    {activeSource.model === 'firestore' ? 'Firestore (Active)' : 
                     activeSource.model === 'environment' ? 'Environment Variables (Active)' : 
                     'Default (gemini-2.0-flash)'}
                  </span>
                </p>
                {envSettings.geminiApiKey && (
                  <p className="text-xs text-muted-foreground">
                    Environment API Key: {envSettings.geminiApiKey}
                  </p>
                )}
                {envSettings.geminiModel && (
                  <p className="text-xs text-muted-foreground">
                    Environment Model: {envSettings.geminiModel}
                  </p>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Google Gemini API Configuration
            </CardTitle>
            <CardDescription>
              Manage the API key and model used by the AI Assistant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={envSettings.geminiApiKey ? `Using env var: ${envSettings.geminiApiKey}` : "AIzaSy..."}
                value={settings.geminiApiKey}
                onChange={(e) =>
                  setSettings({ ...settings, geminiApiKey: e.target.value })
                }
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Your Google Gemini API key. Get one from{' '}
                  <a
                    href="https://makersuite.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google AI Studio
                  </a>
                </p>
                {activeSource.apiKey === 'firestore' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSettings({ ...settings, geminiApiKey: '' });
                    }}
                    className="text-xs"
                  >
                    Clear to use env var
                  </Button>
                )}
              </div>
              {envSettings.geminiApiKey && activeSource.apiKey !== 'environment' && (
                <p className="text-xs text-blue-600">
                  💡 Environment variable is available. Leave empty to use it.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="model" className="flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                Model
              </Label>
              <Select
                value={settings.geminiModel}
                onValueChange={(value) =>
                  setSettings({ ...settings, geminiModel: value })
                }
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  The Gemini model to use. Stable models are recommended for production.
                </p>
                {activeSource.model === 'firestore' && envSettings.geminiModel && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSettings({ ...settings, geminiModel: envSettings.geminiModel || 'gemini-2.0-flash' });
                    }}
                    className="text-xs"
                  >
                    Use env var
                  </Button>
                )}
              </div>
              {envSettings.geminiModel && activeSource.model !== 'environment' && (
                <p className="text-xs text-blue-600">
                  💡 Environment variable ({envSettings.geminiModel}) is available.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  if (originalSettings) {
                    setSettings({ ...originalSettings });
                  } else {
                    setSettings({
                      geminiApiKey: '',
                      geminiModel: 'gemini-2.0-flash',
                    });
                  }
                }}
                disabled={!hasChanges() || saving}
              >
                Reset
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges() || saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

