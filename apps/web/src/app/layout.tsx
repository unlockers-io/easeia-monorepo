import "@/styles/globals.css";

import { webAppUrl } from "@repo/auth/env-config";
import { displayName } from "@repo/identity";
import { canonicalUrl } from "@repo/portless-env/apps";
import { Toaster } from "@repo/ui/components/sonner";
import { ThemeProvider } from "@repo/ui/compositions/theme-provider";
import { BRAND_INK } from "@repo/ui/lib/brand";
import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import { QueryProvider } from "@/components/query-provider";

const schibsted = Schibsted_Grotesk({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-sans-face",
});

const metadataBase = new URL(webAppUrl() ?? canonicalUrl("web"));

export const metadata: Metadata = {
  authors: [{ name: "Easeia Team" }],
  category: "technology",
  creator: displayName,
  description:
    "Central admin for orchestrating posts across a network of Astro sites: multi-site publishing, a cross-site link graph, and a public REST API.",
  keywords: ["astro", "multi-site", "publishing", "rest api", "content orchestration"],
  metadataBase,
  openGraph: {
    description: "Central admin for orchestrating posts across a network of Astro sites.",
    locale: "en_US",
    siteName: displayName,
    title: "Easeia · Multi-Site Astro Orchestrator",
    type: "website",
  },
  publisher: displayName,
  robots: {
    follow: false,
    index: false,
  },
  title: {
    default: "Easeia · Multi-Site Astro Orchestrator",
    template: "%s · Easeia",
  },
  twitter: {
    card: "summary_large_image",
    description: "Central admin for orchestrating posts across a network of Astro sites.",
    title: "Easeia · Multi-Site Astro Orchestrator",
  },
};

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 5,
  themeColor: BRAND_INK,
  userScalable: true,
  width: "device-width",
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html className={schibsted.variable} lang="en" suppressHydrationWarning>
      <head>
        <meta content="telephone=no" name="format-detection" />
        <meta content={BRAND_INK} name="msapplication-TileColor" />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
          <a
            className="sr-only px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:ring-2 focus:ring-ring"
            href="#app-content"
          >
            Skip to content
          </a>
          <div id="app-content" tabIndex={-1}>
            <QueryProvider>{children}</QueryProvider>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;
