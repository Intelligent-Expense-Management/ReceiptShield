"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, DollarSign, Receipt, Clock, CheckCircle, AlertTriangle, Mail, Phone, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getEmployeesForManager } from "@/lib/firebase-user-store";
import { getReceiptsBySupervisor } from "@/lib/firebase-receipt-store";
import type { User, ProcessedReceipt } from "@/types";

interface TeamMemberData {
  user: User;
  totalSpending: number;
  receipts: number;
  pendingApprovals: number;
  fraudAlerts: number;
  lastSubmission: string | null;
}

export default function ManagerTeamPage() {
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMemberData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [teamStats, setTeamStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalSpending: 0,
    averagePerMember: 0,
    pendingApprovals: 0,
    fraudAlerts: 0
  });

  useEffect(() => {
    const loadTeamData = async () => {
      if (!user || user.role !== 'manager') {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Get employees for this manager
        const employees = await getEmployeesForManager(user.id, user.companyId);
        
        // Get all receipts for this manager's team
        const allReceipts = await getReceiptsBySupervisor(user.id, user.companyId);

        const parseDate = (value: unknown): Date => {
          if (!value) {
            return new Date(0);
          }
          if (value instanceof Date) {
            return value;
          }
          if (typeof value === 'string' || typeof value === 'number') {
            return new Date(value);
          }
          return new Date(0);
        };
        
        // Calculate stats for each team member
        const memberData: TeamMemberData[] = employees.map(employee => {
          const employeeReceipts = allReceipts.filter(r => r.uploadedBy === employee.email || r.uploadedBy === employee.id);
          
          const totalSpending = employeeReceipts.reduce((sum, receipt) => {
            const amountItem = receipt.items?.find(i => 
              i.label?.toLowerCase().includes('total') || 
              i.label?.toLowerCase().includes('amount')
            );
            const amountValue = parseFloat(amountItem?.value?.replace(/[^0-9.-]+/g, "") || "0");
            return sum + (isNaN(amountValue) ? 0 : amountValue);
          }, 0);
          
          const pendingApprovals = employeeReceipts.filter(r => 
            r.status === 'pending_approval' || r.status === 'draft'
          ).length;
          
          const fraudAlerts = employeeReceipts.filter(r => r.isFraudulent).length;
          
          const sortedReceipts = [...employeeReceipts].sort((a, b) => {
            const dateA = parseDate(a.uploadedAt);
            const dateB = parseDate(b.uploadedAt);
            return dateB.getTime() - dateA.getTime();
          });
          
          const lastSubmission = sortedReceipts.length > 0 
            ? parseDate(sortedReceipts[0].uploadedAt).toLocaleDateString()
            : null;
          
          return {
            user: employee,
            totalSpending,
            receipts: employeeReceipts.length,
            pendingApprovals,
            fraudAlerts,
            lastSubmission
          };
        });
        
        setTeamMembers(memberData);
        
        // Calculate overall team stats
        const totalSpending = memberData.reduce((sum, m) => sum + m.totalSpending, 0);
        const totalPending = memberData.reduce((sum, m) => sum + m.pendingApprovals, 0);
        const totalFraud = memberData.reduce((sum, m) => sum + m.fraudAlerts, 0);
        const activeMembers = memberData.filter(m => m.user.status === 'active').length;
        
        setTeamStats({
          totalMembers: memberData.length,
          activeMembers,
          totalSpending,
          averagePerMember: memberData.length > 0 ? totalSpending / memberData.length : 0,
          pendingApprovals: totalPending,
          fraudAlerts: totalFraud
        });
      } catch (error) {
        console.error('Error loading team data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeamData();
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "inactive":
        return "secondary";
      case "suspended":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4" />;
      case "inactive":
        return <Clock className="h-4 w-4" />;
      case "suspended":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading team data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
        <p className="text-gray-600 mt-2">Manage your team members and their expense submissions</p>
      </div>

      {/* Team Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamStats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">Team size</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${teamStats.totalSpending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{teamStats.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">Requires review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraud Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{teamStats.fraudAlerts}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage your team members and their expense submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
              <Users className="mx-auto h-12 w-12 text-primary mb-4" />
              <p className="font-semibold">No Team Members Found</p>
              <p>No employees have been assigned to you yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div key={member.user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage 
                        src={`https://placehold.co/40x40.png?text=${member.user.name ? member.user.name[0].toUpperCase() : 'U'}`} 
                        alt={member.user.name}
                        data-ai-hint="abstract letter"
                      />
                      <AvatarFallback>
                        {member.user.name?.split(' ').map(n => n[0]).join('') || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">{member.user.name}</h3>
                        <Badge variant={getStatusColor(member.user.status || 'active')}>
                          {getStatusIcon(member.user.status || 'active')}
                          <span className="ml-1 capitalize">{member.user.status || 'active'}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{member.user.email}</p>
                      <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {member.user.email}
                        </span>
                        <span className="flex items-center">
                          <Receipt className="h-3 w-3 mr-1" />
                          {member.receipts} receipts
                        </span>
                        {member.lastSubmission && (
                          <span>Last: {member.lastSubmission}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="font-bold text-lg">${member.totalSpending.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">Total spent</div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      {member.pendingApprovals > 0 && (
                        <Badge variant="secondary" className="w-fit">
                          {member.pendingApprovals} pending
                        </Badge>
                      )}
                      {member.fraudAlerts > 0 && (
                        <Badge variant="destructive" className="w-fit">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {member.fraudAlerts} fraud alert{member.fraudAlerts > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Team Performance Summary</CardTitle>
          <CardDescription>Key metrics and insights for your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg">
              <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <h3 className="font-medium mb-1">Active Members</h3>
              <p className="text-sm text-gray-600">{teamStats.activeMembers} of {teamStats.totalMembers} members</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h3 className="font-medium mb-1">Average per Member</h3>
              <p className="text-sm text-gray-600">${teamStats.averagePerMember.toFixed(2)} per person</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Receipt className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h3 className="font-medium mb-1">Total Receipts</h3>
              <p className="text-sm text-gray-600">
                {teamMembers.reduce((sum, m) => sum + m.receipts, 0)} receipts submitted
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}