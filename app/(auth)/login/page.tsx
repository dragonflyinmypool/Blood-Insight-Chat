import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to continue to your blood tests.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Link href="/forgot-password" className="hover:text-foreground hover:underline">
            Forgot password?
          </Link>
          <span>
            No account?{" "}
            <Link href="/signup" className="text-foreground hover:underline">
              Sign up
            </Link>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
