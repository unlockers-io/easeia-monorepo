import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import RecoverForm from "@/app/(auth)/recover/form";
import { readIntegrations } from "@/lib/integrations";

const metadata: Metadata = {
  title: "Recover your account",
};

const Recovery = async () => {
  await connection();
  return readIntegrations().mail.configured ? (
    <RecoverForm />
  ) : (
    <div className="space-y-4 text-sm">
      <p>
        Password reset requires RESEND_API_KEY and FROM_EMAIL on this server. Contact your instance
        administrator.
      </p>
      <Link className="underline underline-offset-4" href="/login">
        Back to sign in
      </Link>
    </div>
  );
};

const Page = () => {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          <h2>Recover your account</h2>
        </CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<p>Loading recovery options…</p>}>
          <Recovery />
        </Suspense>
      </CardContent>
    </Card>
  );
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };

export default Page;
