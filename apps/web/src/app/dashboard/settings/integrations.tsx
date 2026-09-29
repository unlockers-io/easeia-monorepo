import { prisma } from "@repo/db";
import { hasUsableDeployHook } from "@repo/sites";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui/components/table";
import Link from "next/link";

import { getEnv } from "@/lib/env";
import { readIntegrations } from "@/lib/integrations";

const FEATURES = {
  dataforseo: { feature: "Live keyword rankings, backlinks, and SEO audits", name: "DataForSEO" },
  google: { feature: "Clicks, impressions, and indexing status", name: "Google Search Console" },
  mail: { feature: "Email verification and password recovery", name: "Email" },
  openai: { feature: "AI drafts, rewrites, image prompts, and similar posts", name: "OpenAI" },
  r2: { feature: "Image uploads and public image delivery", name: "Cloudflare R2" },
};

export const IntegrationsCard = async () => {
  const integrations = readIntegrations();
  const sites = await prisma.site.findMany({ select: { vercelDeployHookUrl: true } });
  const ready = sites.filter((site) => hasUsableDeployHook(site.vercelDeployHookUrl)).length;
  return (
    <Card id="integrations">
      <CardHeader>
        <CardTitle>
          <h2>Integrations</h2>
        </CardTitle>
        <CardDescription>
          Configure these environment variables on your server, then restart the apps. Credentials
          are never shown here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Integration</TableHead>
              <TableHead>Enables</TableHead>
              <TableHead>Configuration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(["openai", "dataforseo", "google", "mail", "r2"] as const).map((key) => {
              const status = integrations[key];
              const feature = FEATURES[key];
              return (
                <TableRow key={key}>
                  <TableCell>{feature.name}</TableCell>
                  <TableCell className="whitespace-normal">{feature.feature}</TableCell>
                  <TableCell className="whitespace-normal">
                    {status.configured ? "Configured" : `Missing: ${status.missing.join(", ")}`}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="text-sm">
          Sign-up mode: <code>{getEnv().SIGNUP_MODE}</code>. Every account has full administrator
          access.
        </p>
        <p className="text-sm">
          {ready} of {sites.length} sites have a deploy hook.{" "}
          <Link className="underline" href="/dashboard/sites">
            Manage sites
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
};
