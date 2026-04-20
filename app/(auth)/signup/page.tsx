import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "./form";

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Track biomarkers and chat with AI about your results.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignupForm />
        <div className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
