'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import type { Company, User } from '@/types';

interface AssignCompanyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  companies: Company[];
  onAssign: (companyId: string) => void;
}

export function AssignCompanyDialog({
  isOpen,
  onClose,
  user,
  companies,
  onAssign,
}: AssignCompanyDialogProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Reset selection when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedCompanyId('');
    }
  }, [isOpen]);

  const handleAssign = () => {
    if (selectedCompanyId) {
      onAssign(selectedCompanyId);
      setSelectedCompanyId('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Assign User to Company
          </DialogTitle>
          <DialogDescription>
            Assign <strong>{user?.name}</strong> ({user?.email}) to a company.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name} ({company.subscriptionTier})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedCompanyId}>
            Assign Company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

