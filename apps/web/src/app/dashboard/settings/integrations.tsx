import * as Sites from "@repo/sites";
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

export const IntegrationsCard = async () => {
  const integrations = readIntegrations();
  const sites = await Sites.list();
  const ready = sites.filter(Sites.hasDeployHook).length;

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
            {Object.values(integrations)
              .toSorted((a, b) => a.name.localeCompare(b.name))
              .map((integration) => (
                <TableRow key={integration.name}>
                  <TableCell>{integration.name}</TableCell>
                  <TableCell className="whitespace-normal">{integration.feature}</TableCell>
                  <TableCell className="whitespace-normal">
                    {integration.configured
                      ? "Configured"
                      : `Missing: ${integration.missing.join(", ")}`}
                  </TableCell>
                </TableRow>
              ))}
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
