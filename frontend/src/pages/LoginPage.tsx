import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Shield, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { useStore } from "../lib/store";
import { authApi } from "../api/authApi";
import { loginSchema, LoginFormValues } from "../validation/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const { setCurrentUser, setIsAuthenticated } = useStore();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = form.handleSubmit(async (values) => {
    setError("");
    setIsLoading(true);
    try {
      const result = await authApi.login({ email: values.email!, password: values.password! });
      // Fix role detection - check boolean flags correctly
      const role = result.user?.roleAdmin === true ? "admin" 
                 : result.user?.roleCreator === true ? "creator" 
                 : "solver";
      const username = result.user?.displayName || values.email.split("@")[0];
      setCurrentUser({
        id: result.user?.id || "",
        username,
        firstName: result.user?.displayName || username,
        lastName: "",
        email: result.user?.email || values.email,
        country: "N/A",
        role,
        mfaEnabled: Boolean(result.user?.twofaSecret),
        avatarUrl: result.user?.avatarUrl || "",
        pointsTotal: 0,
        badges: [],
        followedPlaylists: [],
        history: [],
        roleAdmin: result.user?.roleAdmin === true,
        roleCreator: result.user?.roleCreator === true,
        roleSolver: result.user?.roleSolver === true,
      });
      setIsAuthenticated(true);
      toast.success(`Welcome back, ${username}!`);
      navigate("/");
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const message = err?.response?.data?.message || "Unable to sign in";
      if (code === "MAINTENANCE_MODE") {
        setError("Sign-in disabled while the platform is in maintenance mode.");
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Cyber Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10" />
      
      {/* Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

      {/* Login Card */}
      <Card className="relative z-10 w-full max-w-md border-2 border-primary/30 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/20">
        <CardHeader className="space-y-4 text-center pb-6">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl blur-xl opacity-50 animate-pulse" />
              <div className="relative flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg">
                <Shield className="h-9 w-9 text-white" />
              </div>
            </div>
          </div>
          
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              RangeX
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Cloud-enabled cyber range platform
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  className="pl-10 h-11"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-400">{form.formState.errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  className="pl-10 h-11"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-red-400">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="text-center space-y-1 pt-2">
              <p className="text-xs text-muted-foreground">
                All accounts are created and managed by administrators.
              </p>
              <p className="text-xs text-muted-foreground">
                Need access? Contact your RangeX administrator.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
