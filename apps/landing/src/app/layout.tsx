import "@/styles/globals.css";

import { displayName, origins } from "@repo/identity";
import { BRAND_INK } from "@repo/ui/lib/brand";
import { cn } from "@repo/ui/lib/utils";
import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";

import { Analytics } from "@/components/analytics";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { DESCRIPTION } from "@/lib/site";
import { GITHUB_URL } from "@/lib/urls";

const TAGLINE = "Open-source dashboard for private blog networks";

const LONG_DESCRIPTION =
  "Run a private blog network from one dashboard. AI drafts, scheduled Astro publishing, money-site links, and search reports. Free MIT self-hosting; Cloud waitlist.";

const metadata = {
  alternates: { canonical: "/" },
  description: LONG_DESCRIPTION,
  metadataBase: new URL(origins.landing),
  openGraph: {
    description: DESCRIPTION,
    locale: "en-US",
    siteName: displayName,
    title: displayName,
    type: "website",
  },
  title: {
    default: `${displayName} · ${TAGLINE}`,
    template: `%s · ${displayName}`,
  },
  twitter: {
    card: "summary_large_image",
    description: DESCRIPTION,
    title: `${displayName} · ${TAGLINE}`,
  },
} satisfies Metadata;

const viewport = {
  themeColor: BRAND_INK,
} satisfies Viewport;

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-face",
});

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html className="scroll-smooth motion-reduce:scroll-auto" lang="en-US" suppressHydrationWarning>
      <body
        className={cn(
          "relative isolate flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased",
          schibsted.variable,
        )}
      >
        <a
          className="sr-only px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:ring-2 focus:ring-ring"
          href="#main-content"
        >
          Skip to content
        </a>
        <Header />
        <main className="flex-1" id="main-content">
          {children}
        </main>
        <Footer />

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            applicationCategory: "DeveloperApplication",
            codeRepository: GITHUB_URL,
            description: LONG_DESCRIPTION,
            license: `${GITHUB_URL}/blob/main/LICENSE`,
            name: displayName,
            offers: {
              "@type": "Offer",
              description:
                "Self-hosted MIT software. Hosting and third-party services charged separately.",
              price: "0",
              priceCurrency: "USD",
            },
            operatingSystem: "Linux, macOS, Windows (Docker)",
            url: origins.landing,
          })}
        </script>
        <Analytics />
      </body>
    </html>
  );
};

export { metadata, viewport };

export default RootLayout;
