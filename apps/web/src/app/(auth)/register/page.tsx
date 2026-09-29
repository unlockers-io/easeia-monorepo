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

import RegisterForm from "@/app/(auth)/register/form";
import { getSignupState } from "@/lib/signup-state";

const metadata: Metadata = {
  title: "Create an account",
};

type Props = {
  searchParams: Promise<{ from?: string }>;
};

const Registration = async ({ searchParams }: Props) => {
  const signup = await getSignupState();
  if (!signup.open) {
    return (
      <>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            <h2>Registration is closed</h2>
          </CardTitle>
          <CardDescription>
            {signup.mode === "closed"
              ? "Sign-ups are closed on this instance."
              : "This instance already has an administrator."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link className="underline underline-offset-4" href="/login">
            Sign in
          </Link>
        </CardContent>
      </>
    );
  }
  return (
    <>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          <h2>Create your account</h2>
        </CardTitle>
        <CardDescription>Enter your details below to create your account</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm searchParams={searchParams} />
      </CardContent>
    </>
  );
};

const Page = ({ searchParams }: Props) => (
  <Card>
    <Suspense
      fallback={
        <CardContent>
          <p>Checking registration availability…</p>
        </CardContent>
      }
    >
      <Registration searchParams={searchParams} />
    </Suspense>
  </Card>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };

export default Page;
