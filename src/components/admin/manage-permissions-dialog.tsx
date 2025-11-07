'use client';

import { useState, useEffect } from 'react';
import type { User, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { updateUser, getManagers } from '@/lib/firebase-user-store';
import { AlertTriangle, Loader2, Shield, UserCog, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { Separator } from '@/components/ui/separator';

interface ManagePermissionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onPermissionsUpdated: () => void;
}

export function ManagePermissionsDialog({
  isOpen,
  onClose,
  user,
  onPermissionsUpdated,
}: ManagePermissionsDialogProps) {
  const { user: currentUser } = useAuth();
  const [role, setRole] = useState<UserRole>('employee');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [supervisorId, setSupervisorId] = useState<string>('none');
  const [canManageSubscription, setCanManageSubscription] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [managers, setManagers] = useState<User[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingAdmin, setIsConfirmingAdmin] = useState(false);
  const [isConfirmingPlatformAdmin, setIsConfirmingPlatformAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setRole(user.role || 'employee');
      setStatus(user.status === 'active' ? 'active' : 'inactive');
      setSupervisorId(user.supervisorId || 'none');
      setCanManageSubscription(user.canManageSubscription || false);
      setIsPlatformAdmin(user.isPlatformAdmin || false);
      loadManagers();
    }
  }, [user, isOpen]);

  const loadManagers = async () => {
    try {
      const companyId = currentUser?.isPlatformAdmin ? undefined : currentUser?.companyId;
      const allManagers = await getManagers(companyId);
      setManagers(allManagers);
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  };

  if (!user) return null;

  // Check if current user can manage this user
  const canManageUser = currentUser?.role === 'admin' || currentUser?.isPlatformAdmin;
  const canChangePlatformAdmin = currentUser?.isPlatformAdmin && currentUser?.id !== user.id;
  const isCurrentUser = currentUser?.id === user.id;
  const isCompanyOwner = user.isCompanyOwner;
  
  // Restrictions
  const canChangeRole = !isCompanyOwner && !isCurrentUser && user.role !== 'admin';
  const canChangeStatus = !isCompanyOwner && !isCurrentUser;
  const canChangeSubscriptionPermission = currentUser?.isCompanyOwner || currentUser?.canManageSubscription;

  const proceedWithSave = async () => {
    setIsSaving(true);
    
    try {
      const updates: Partial<User> = {
        role,
        status,
        canManageSubscription,
      };

      // Handle supervisor assignment (only for employees)
      if (role === 'employee') {
        updates.supervisorId = supervisorId === 'none' ? undefined : supervisorId;
      } else {
        // Clear supervisor if role is changed from employee
        updates.supervisorId = undefined;
      }

      // Only allow platform admin changes by platform admins
      if (currentUser?.isPlatformAdmin && currentUser?.id !== user.id) {
        updates.isPlatformAdmin = isPlatformAdmin;
      }

      await updateUser(user.id, updates);
      
      onPermissionsUpdated();
      toast({
        title: "Permissions Updated",
        description: `Permissions for ${user.name} have been successfully updated.`,
      });
      onClose();
    } catch (error: any) {
      console.error('Error updating permissions:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update permissions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setIsConfirmingAdmin(false);
      setIsConfirmingPlatformAdmin(false);
    }
  };

  const handleSave = () => {
    // Check if promoting to admin
    if (role === 'admin' && user.role !== 'admin' && !isConfirmingAdmin) {
      setIsConfirmingAdmin(true);
      return;
    }

    // Check if granting platform admin
    if (isPlatformAdmin && !user.isPlatformAdmin && !isConfirmingPlatformAdmin && canChangePlatformAdmin) {
      setIsConfirmingPlatformAdmin(true);
      return;
    }

    proceedWithSave();
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    // If changing from employee, clear supervisor
    if (newRole !== 'employee') {
      setSupervisorId('none');
    }
  };

  if (!canManageUser) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
            <DialogDescription>
              You don't have permission to manage user permissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen && !isConfirmingAdmin && !isConfirmingPlatformAdmin} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Manage Permissions
            </DialogTitle>
            <DialogDescription>
              Update roles and permissions for <strong>{user.name}</strong> ({user.email})
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* User Info */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex gap-2">
                  {isCompanyOwner && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Company Owner
                    </Badge>
                  )}
                  {user.isPlatformAdmin && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      Platform Admin
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Role Management */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="role">User Role</Label>
                  <p className="text-xs text-muted-foreground">
                    Defines the user's access level and capabilities
                  </p>
                </div>
              </div>
              <Select
                value={role}
                onValueChange={(value) => handleRoleChange(value as UserRole)}
                disabled={isSaving || !canChangeRole}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {!canChangeRole && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 mt-0.5" />
                  <p>
                    {isCompanyOwner 
                      ? "Company owner role cannot be changed." 
                      : isCurrentUser
                      ? "You cannot change your own role."
                      : "Admin roles cannot be changed."}
                  </p>
                </div>
              )}
            </div>

            {/* Supervisor Assignment (for employees only) */}
            {role === 'employee' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="supervisor">Supervisor</Label>
                    <p className="text-xs text-muted-foreground">
                      Assign a manager to oversee this employee
                    </p>
                  </div>
                </div>
                <Select
                  value={supervisorId}
                  onValueChange={setSupervisorId}
                  disabled={isSaving || managers.length === 0}
                >
                  <SelectTrigger id="supervisor">
                    <SelectValue placeholder={managers.length === 0 ? "No managers available" : "Select a supervisor"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name} ({manager.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {/* Status Management */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="status">Account Status</Label>
                  <p className="text-xs text-muted-foreground">
                    Active users can log in, inactive users cannot
                  </p>
                </div>
              </div>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as 'active' | 'inactive')}
                disabled={isSaving || !canChangeStatus}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {!canChangeStatus && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 mt-0.5" />
                  <p>
                    {isCompanyOwner 
                      ? "Company owner status cannot be changed." 
                      : "You cannot change your own status."}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Subscription Management Permission */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="subscription-permission">Can Manage Subscription</Label>
                    <Badge variant="outline" className="text-xs">Company Setting</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Allows this user to manage subscription and billing settings
                  </p>
                </div>
                <Switch
                  id="subscription-permission"
                  checked={canManageSubscription}
                  onCheckedChange={setCanManageSubscription}
                  disabled={isSaving || !canChangeSubscriptionPermission || isCompanyOwner}
                />
              </div>
              {isCompanyOwner && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 mt-0.5" />
                  <p>Company owners automatically have subscription management permissions.</p>
                </div>
              )}
              {!canChangeSubscriptionPermission && !isCompanyOwner && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 mt-0.5" />
                  <p>Only company owners or users with subscription management permissions can grant this permission.</p>
                </div>
              )}
            </div>

            {/* Platform Admin (only for platform admins) */}
            {canChangePlatformAdmin && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="platform-admin">Platform Administrator</Label>
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">System Setting</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Grants cross-company access and system-wide administration privileges
                      </p>
                    </div>
                    <Switch
                      id="platform-admin"
                      checked={isPlatformAdmin}
                      onCheckedChange={setIsPlatformAdmin}
                      disabled={isSaving || isCurrentUser}
                    />
                  </div>
                  {isCurrentUser && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="h-3 w-3 mt-0.5" />
                      <p>You cannot change your own platform admin status.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Admin Promotion */}
      <AlertDialog open={isConfirmingAdmin} onOpenChange={setIsConfirmingAdmin}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-destructive"/>
              Promote to Admin?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to promote <strong>{user.name}</strong> to an <strong>Admin</strong>.
              Admins have full access to manage users, view all company data, and configure settings.
              This action is significant and should be done carefully.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmingAdmin(false)} disabled={isSaving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={proceedWithSave}
              disabled={isSaving}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Promote to Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Platform Admin Grant */}
      <AlertDialog open={isConfirmingPlatformAdmin} onOpenChange={setIsConfirmingPlatformAdmin}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-orange-600"/>
              Grant Platform Admin Access?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to grant <strong>Platform Administrator</strong> privileges to <strong>{user.name}</strong>.
              Platform admins have access to all companies and can perform system-wide administrative tasks.
              This is a highly privileged role and should only be granted to trusted administrators.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmingPlatformAdmin(false)} disabled={isSaving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={proceedWithSave}
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Grant Platform Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

