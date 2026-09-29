import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { Metadata } from "next";
import { Suspense } from "react";

import LoginForm from "@/app/(auth)/login/form";
import { readIntegrations } from "@/lib/integrations";
import { getSignupState } from "@/lib/signup-state";

const metadata: Metadata = {
  description: "Sign in to your Easeia account to access your dashboard and manage your profile.",
  title: "Sign in",
};

type Props = {
  searchParams: Promise<{ from?: string }>;
};

const GatedLoginForm = async ({ searchParams }: Props) => {
  const signup = await getSignupState();
  return (
    <LoginForm
      mailConfigured={readIntegrations().mail.configured}
      searchParams={searchParams}
      signupOpen={signup.open}
    />
  );
};

const Page = ({ searchParams }: Props) => (
  <Card>
    <CardHeader className="text-center">
      <CardTitle className="text-xl">
        <h2>Welcome back</h2>
      </CardTitle>
      <CardDescription>Enter your details to sign in to your account</CardDescription>
    </CardHeader>
    <CardContent>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading sign-in…</p>}>
        <GatedLoginForm searchParams={searchParams} />
      </Suspense>
    </CardContent>
  </Card>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };

export default Page;
