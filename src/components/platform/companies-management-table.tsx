'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Users, FileText, Calendar, Search, Eye, Loader2 } from 'lucide-react';
import { getAllCompanies } from '@/lib/firebase-company-store';
import { getUserById } from '@/lib/firebase-user-store';
import type { Company } from '@/types';
import { format } from 'date-fns';

interface CompanyWithDetails extends Company {
  ownerName?: string;
  ownerEmail?: string;
}

export function CompaniesManagementTable() {
  const [companies, setCompanies] = useState<CompanyWithDetails[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setIsLoading(true);
        const allCompanies = await getAllCompanies();

        // Enrich companies with owner details and current usage
        const enrichedCompanies = await Promise.all(
          allCompanies.map(async (company) => {
            try {
              const owner = await getUserById(company.ownerId);
              return {
                ...company,
                ownerName: owner?.name || 'Unknown',
                ownerEmail: owner?.email || 'N/A',
              };
            } catch (error) {
              console.error(`Error fetching owner for company ${company.id}:`, error);
              return {
                ...company,
                ownerName: 'Unknown',
                ownerEmail: 'N/A',
              };
            }
          })
        );

        setCompanies(enrichedCompanies);
        setFilteredCompanies(enrichedCompanies);
      } catch (error) {
        console.error('Error fetching companies:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCompanies(companies);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = companies.filter(
      (company) =>
        company.name.toLowerCase().includes(query) ||
        company.ownerName?.toLowerCase().includes(query) ||
        company.ownerEmail?.toLowerCase().includes(query) ||
        company.subscriptionTier.toLowerCase().includes(query) ||
        company.subscriptionStatus.toLowerCase().includes(query)
    );
    setFilteredCompanies(filtered);
  }, [searchQuery, companies]);

  const getSubscriptionBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'trialing':
        return 'secondary';
      case 'past_due':
      case 'expired':
        return 'destructive';
      case 'canceled':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getTierBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'default';
      case 'professional':
        return 'secondary';
      case 'basic':
        return 'outline';
      case 'trial':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Companies Management</CardTitle>
          <CardDescription>Manage all companies and their subscriptions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Companies Management</CardTitle>
            <CardDescription>Manage all companies and their subscriptions</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Subscription Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Receipts</TableHead>
                <TableHead>Trial Ends</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No companies found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {company.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{company.ownerName}</div>
                        <div className="text-sm text-muted-foreground">{company.ownerEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTierBadgeVariant(company.subscriptionTier)}>
                        {company.subscriptionTier.charAt(0).toUpperCase() + company.subscriptionTier.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSubscriptionBadgeVariant(company.subscriptionStatus)}>
                        {company.subscriptionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {company.userCount || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {company.receiptCount || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.trialEndsAt ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(
                            company.trialEndsAt instanceof Date
                              ? company.trialEndsAt
                              : new Date(company.trialEndsAt),
                            'MMM d, yyyy'
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {company.createdAt ? (
                        <div className="text-sm text-muted-foreground">
                          {format(
                            company.createdAt instanceof Date
                              ? company.createdAt
                              : new Date(company.createdAt),
                            'MMM d, yyyy'
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // TODO: Navigate to company details page
                          console.log('View company:', company.id);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

