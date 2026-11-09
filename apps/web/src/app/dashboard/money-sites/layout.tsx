import type { Metadata } from "next";
import type { ReactNode } from "react";

/** @public Next.js app-router reads metadata via the module loader */
export const metadata: Metadata = {
  title: "Money sites",
};

const Layout = ({ children }: { children: ReactNode }) => children;

export default Layout;
