import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import ResetPasswordForm from "@/app/(auth)/reset-password/form";

const metadata: Metadata = {
  title: "Reset your password",
};

type Props = {
  searchParams: Promise<{ token?: string }>;
};

const Reset = async ({ searchParams }: Props) => {
  const { token = "" } = await searchParams;
  if (token === "") {
    return (
      <>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            <h2>Invalid reset link</h2>
          </CardTitle>
          <CardDescription>This password reset link is invalid or has expired.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 text-sm">
            <Link className="text-foreground underline underline-offset-4" href="/recover">
              Request a new reset link
            </Link>
            <Link className="text-foreground underline underline-offset-4" href="/login">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </>
    );
  }
  return (
    <>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          <h2>Reset your password</h2>
        </CardTitle>
        <CardDescription>Enter a new password for your account</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
    </>
  );
};

const Page = ({ searchParams }: Props) => (
  <Card>
    <Suspense
      fallback={
        <CardContent>
          <p>Loading…</p>
        </CardContent>
      }
    >
      <Reset searchParams={searchParams} />
    </Suspense>
  </Card>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };

export default Page;
