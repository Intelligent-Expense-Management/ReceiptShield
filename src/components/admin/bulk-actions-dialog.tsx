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
import { Badge } from '@/components/ui/badge';
import { updateUser, getManagers } from '@/lib/firebase-user-store';
import { AlertTriangle, Loader2, Users, UserCheck, UserX, UserCog, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BulkActionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: User[];
  onActionComplete: () => void;
}

type BulkActionType = 'activate' | 'deactivate' | 'changeRole' | 'reassignSupervisor' | null;

export function BulkActionsDialog({
  isOpen,
  onClose,
  selectedUsers,
  onActionComplete,
}: BulkActionsDialogProps) {
  const { user: currentUser } = useAuth();
  const [actionType, setActionType] = useState<BulkActionType>(null);
  const [newRole, setNewRole] = useState<UserRole>('employee');
  const [supervisorId, setSupervisorId] = useState<string>('');
  const [managers, setManagers] = useState<User[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && selectedUsers.length > 0) {
      loadManagers();
      // Reset state when dialog opens
      setActionType(null);
      setNewRole('employee');
      setSupervisorId('');
      setResults(null);
    }
  }, [isOpen, selectedUsers]);

  const loadManagers = async () => {
    try {
      const companyId = currentUser?.isPlatformAdmin ? undefined : currentUser?.companyId;
      const allManagers = await getManagers(companyId);
      setManagers(allManagers);
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  };

  if (!isOpen || selectedUsers.length === 0) return null;

  // Filter users based on what actions can be performed
  const canActivate = selectedUsers.filter(u => u.status === 'inactive' && !u.isCompanyOwner && u.id !== currentUser?.id);
  const canDeactivate = selectedUsers.filter(u => u.status === 'active' && !u.isCompanyOwner && u.id !== currentUser?.id && u.role !== 'admin');
  const canChangeRole = selectedUsers.filter(u => !u.isCompanyOwner && u.id !== currentUser?.id && u.role !== 'admin');
  const employeesOnly = selectedUsers.filter(u => u.role === 'employee');
  
  const proceedWithAction = async () => {
    setIsProcessing(true);
    setResults(null);
    
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      // Filter users based on action type
      let usersToProcess: User[] = [];
      
      switch (actionType) {
        case 'activate':
          usersToProcess = canActivate;
          break;
        case 'deactivate':
          usersToProcess = canDeactivate;
          break;
        case 'changeRole':
          usersToProcess = canChangeRole;
          break;
        case 'reassignSupervisor':
          usersToProcess = employeesOnly;
          break;
        default:
          usersToProcess = [];
      }

      if (usersToProcess.length === 0) {
        toast({
          title: "No Users Eligible",
          description: "None of the selected users are eligible for this action.",
          variant: "destructive",
        });
        setIsProcessing(false);
        setIsConfirming(false);
        return;
      }

      // Process each user
      for (const user of usersToProcess) {
        try {
          const updates: Partial<User> = {};

          switch (actionType) {
            case 'activate':
              updates.status = 'active';
              break;
            case 'deactivate':
              updates.status = 'inactive';
              break;
            case 'changeRole':
              updates.role = newRole;
              // Clear supervisor if changing from employee
              if (user.role === 'employee' && newRole !== 'employee') {
                updates.supervisorId = undefined;
              }
              // Clear supervisor if changing to employee but no supervisor selected
              if (newRole === 'employee' && !supervisorId) {
                updates.supervisorId = undefined;
              }
              break;
            case 'reassignSupervisor':
              if (supervisorId) {
                updates.supervisorId = supervisorId;
              }
              break;
          }

          await updateUser(user.id, updates);
          successCount++;
        } catch (error: any) {
          failedCount++;
          errors.push(`${user.name}: ${error.message || 'Unknown error'}`);
          console.error(`Error updating user ${user.id}:`, error);
        }
      }

      setResults({ success: successCount, failed: failedCount, errors });

      if (successCount > 0) {
        toast({
          title: "Bulk Action Complete",
          description: `Successfully updated ${successCount} user${successCount > 1 ? 's' : ''}${failedCount > 0 ? ` (${failedCount} failed)` : ''}.`,
        });
        onActionComplete();
        
        // Close dialog after a short delay if all succeeded
        if (failedCount === 0) {
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } else {
        toast({
          title: "Action Failed",
          description: "Failed to update any users. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error in bulk action:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred while processing the bulk action.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setIsConfirming(false);
    }
  };

  const handleConfirmAction = () => {
    if (!actionType) return;

    // Check if confirmation is needed
    const needsConfirmation = actionType === 'deactivate' || 
                            actionType === 'changeRole' && newRole === 'admin';
    
    if (needsConfirmation) {
      setIsConfirming(true);
    } else {
      proceedWithAction();
    }
  };

  const getActionDescription = () => {
    switch (actionType) {
      case 'activate':
        return `Activate ${canActivate.length} user${canActivate.length !== 1 ? 's' : ''}?`;
      case 'deactivate':
        return `Deactivate ${canDeactivate.length} user${canDeactivate.length !== 1 ? 's' : ''}?`;
      case 'changeRole':
        return `Change role to ${newRole} for ${canChangeRole.length} user${canChangeRole.length !== 1 ? 's' : ''}?`;
      case 'reassignSupervisor':
        const supervisor = managers.find(m => m.id === supervisorId);
        return `Reassign ${employeesOnly.length} employee${employeesOnly.length !== 1 ? 's' : ''} to ${supervisor?.name || 'selected supervisor'}?`;
      default:
        return '';
    }
  };

  const getSelectedUsersSummary = () => {
    const total = selectedUsers.length;
    const active = selectedUsers.filter(u => u.status === 'active').length;
    const inactive = selectedUsers.filter(u => u.status === 'inactive').length;
    const employees = selectedUsers.filter(u => u.role === 'employee').length;
    const managers = selectedUsers.filter(u => u.role === 'manager').length;
    const admins = selectedUsers.filter(u => u.role === 'admin').length;
    const owners = selectedUsers.filter(u => u.isCompanyOwner).length;

    return { total, active, inactive, employees, managers, admins, owners };
  };

  const summary = getSelectedUsersSummary();

  return (
    <>
      <Dialog open={isOpen && !isConfirming && !results} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Bulk Actions
            </DialogTitle>
            <DialogDescription>
              Perform actions on {selectedUsers.length} selected user{selectedUsers.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* Selected Users Summary */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Selected</p>
                  <p className="font-semibold text-lg">{summary.total}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Active</p>
                  <p className="font-semibold text-green-600">{summary.active}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Inactive</p>
                  <p className="font-semibold text-yellow-600">{summary.inactive}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Employees</p>
                  <p className="font-semibold">{summary.employees}</p>
                </div>
              </div>
              {summary.owners > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  ⚠️ {summary.owners} company owner{summary.owners !== 1 ? 's' : ''} cannot be modified
                </div>
              )}
            </div>

            <Separator />

            {/* Action Selection */}
            <div className="space-y-4">
              <Label>Select Action</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={actionType === 'activate' ? 'default' : 'outline'}
                  onClick={() => setActionType('activate')}
                  disabled={canActivate.length === 0}
                  className="h-auto py-3 flex-col gap-1"
                >
                  <UserCheck className="h-5 w-5" />
                  <span>Activate Users</span>
                  <span className="text-xs text-muted-foreground">
                    {canActivate.length} eligible
                  </span>
                </Button>
                
                <Button
                  variant={actionType === 'deactivate' ? 'default' : 'outline'}
                  onClick={() => setActionType('deactivate')}
                  disabled={canDeactivate.length === 0}
                  className="h-auto py-3 flex-col gap-1"
                >
                  <UserX className="h-5 w-5" />
                  <span>Deactivate Users</span>
                  <span className="text-xs text-muted-foreground">
                    {canDeactivate.length} eligible
                  </span>
                </Button>
                
                <Button
                  variant={actionType === 'changeRole' ? 'default' : 'outline'}
                  onClick={() => setActionType('changeRole')}
                  disabled={canChangeRole.length === 0}
                  className="h-auto py-3 flex-col gap-1"
                >
                  <Shield className="h-5 w-5" />
                  <span>Change Role</span>
                  <span className="text-xs text-muted-foreground">
                    {canChangeRole.length} eligible
                  </span>
                </Button>
                
                <Button
                  variant={actionType === 'reassignSupervisor' ? 'default' : 'outline'}
                  onClick={() => setActionType('reassignSupervisor')}
                  disabled={employeesOnly.length === 0 || managers.length === 0}
                  className="h-auto py-3 flex-col gap-1"
                >
                  <UserCog className="h-5 w-5" />
                  <span>Reassign Supervisor</span>
                  <span className="text-xs text-muted-foreground">
                    {employeesOnly.length} employees
                  </span>
                </Button>
              </div>
            </div>

            {/* Action Configuration */}
            {actionType === 'changeRole' && (
              <div className="space-y-3">
                <Label htmlFor="new-role">New Role</Label>
                <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {newRole === 'admin' && (
                  <div className="flex items-start gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <p>Warning: This will grant admin privileges to {canChangeRole.length} user(s).</p>
                  </div>
                )}
              </div>
            )}

            {actionType === 'reassignSupervisor' && (
              <div className="space-y-3">
                <Label htmlFor="supervisor">Supervisor</Label>
                <Select value={supervisorId} onValueChange={setSupervisorId}>
                  <SelectTrigger id="supervisor">
                    <SelectValue placeholder="Select a supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name} ({manager.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!supervisorId && (
                  <p className="text-xs text-muted-foreground">
                    Select a supervisor to assign to {employeesOnly.length} employee(s)
                  </p>
                )}
              </div>
            )}

            {/* Selected Users List */}
            {selectedUsers.length <= 10 && (
              <div className="space-y-2">
                <Label>Selected Users ({selectedUsers.length})</Label>
                <ScrollArea className="h-32 border rounded-md p-2">
                  <div className="space-y-1">
                    {selectedUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between text-sm">
                        <span>{user.name}</span>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            {user.role}
                          </Badge>
                          <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {user.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmAction} 
              disabled={isProcessing || !actionType || 
                       (actionType === 'reassignSupervisor' && !supervisorId)}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-destructive"/>
              Confirm Bulk Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getActionDescription()}
              {actionType === 'deactivate' && (
                <p className="mt-2 text-sm">
                  Deactivated users will not be able to log in until they are reactivated.
                </p>
              )}
              {actionType === 'changeRole' && newRole === 'admin' && (
                <p className="mt-2 text-sm font-medium text-orange-600">
                  Warning: Admin users have full access to company data and settings.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirming(false)} disabled={isProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={proceedWithAction}
              disabled={isProcessing}
              className={actionType === 'deactivate' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Results Dialog */}
      {results && (
        <Dialog open={!!results} onOpenChange={() => setResults(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Action Results</DialogTitle>
              <DialogDescription>
                Action completed with {results.success} success{results.success !== 1 ? 'es' : ''} and {results.failed} failure{results.failed !== 1 ? 's' : ''}
              </DialogDescription>
            </DialogHeader>
            {results.errors.length > 0 && (
              <ScrollArea className="h-32 border rounded-md p-2">
                <div className="space-y-1 text-sm">
                  {results.errors.map((error, idx) => (
                    <div key={idx} className="text-destructive">{error}</div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <DialogFooter>
              <Button onClick={() => {
                setResults(null);
                if (results.failed === 0) {
                  onClose();
                }
              }}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

