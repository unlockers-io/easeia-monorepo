import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { getSession } from "@/lib/auth-helpers";

/** @public Next.js app-router reads metadata via the module loader */
export const metadata: Metadata = {
  title: "Money sites",
};

const AuthGate = async ({ children }: { children: ReactNode }) => {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return children;
};

const Layout = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={null}>
    <AuthGate>{children}</AuthGate>
  </Suspense>
);

export default Layout;
