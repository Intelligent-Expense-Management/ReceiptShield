"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Building2, User, Mail } from "lucide-react";
import { getUserByEmail } from "@/lib/firebase-user-store";
import { getCompany } from "@/lib/firebase-company-store";
import type { User as UserType } from "@/types";

export default function CheckUserPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setUser(null);
    setCompany(null);

    try {
      const foundUser = await getUserByEmail(email.trim());
      
      if (!foundUser) {
        setError(`User not found with email: ${email}`);
        setIsLoading(false);
        return;
      }

      setUser(foundUser);

      if (foundUser.companyId) {
        const foundCompany = await getCompany(foundUser.companyId);
        setCompany(foundCompany);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Check User Company</h1>
        <p className="text-gray-600 mt-2">Find which company a user belongs to</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search by Email</CardTitle>
          <CardDescription>Enter an email address to find the user's company</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {user && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{user.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <Badge variant="outline" className="capitalize">{user.role}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={user.status === "active" ? "default" : "secondary"} className="capitalize">
                  {user.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Company ID</p>
                <p className="font-mono text-sm">{user.companyId || "N/A"}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {user.isCompanyOwner && (
                  <Badge variant="default">Company Owner</Badge>
                )}
                {user.canManageSubscription && (
                  <Badge variant="secondary">Can Manage Subscription</Badge>
                )}
                {user.isPlatformAdmin && (
                  <Badge variant="destructive">Platform Admin</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {company ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Company Name</p>
                    <p className="font-medium text-lg">{company.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subscription Tier</p>
                    <Badge variant="outline" className="capitalize">{company.subscriptionTier}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subscription Status</p>
                    <Badge 
                      variant={
                        company.subscriptionStatus === "active" || company.subscriptionStatus === "trialing"
                          ? "default"
                          : "destructive"
                      }
                      className="capitalize"
                    >
                      {company.subscriptionStatus}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Receipt Count</p>
                    <p className="font-medium">{company.receiptCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">User Count</p>
                    <p className="font-medium">{company.userCount || 0}</p>
                  </div>
                  {company.trialEndsAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Trial Ends At</p>
                      <p className="font-medium">
                        {company.trialEndsAt instanceof Date
                          ? company.trialEndsAt.toLocaleString()
                          : new Date(company.trialEndsAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {user.companyId 
                    ? "Company not found (companyId exists but company document is missing)"
                    : "User is not associated with any company"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {user && company && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <p className="text-lg font-semibold text-center">
              ✅ <strong>{user.name}</strong> ({user.email}) belongs to <strong>"{company.name}"</strong>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

