import { listApiKeys } from "@repo/policy";
import * as Sites from "@repo/sites";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { connection } from "next/server";

import { ActionButton } from "@/components/action-button";

import { revokeApiKeyAction } from "./actions";
import { CreateKeyDialog } from "./create-key-dialog";

const ApiKeysPage = async () => {
  await connection();

  const [keys, sites] = await Promise.all([listApiKeys(), Sites.listEnabled()]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-row items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Bearer tokens for the public REST API. Tokens are shown once at creation; rotate by
            revoking and re-issuing.
          </p>
        </div>
        <CreateKeyDialog sites={sites} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Active keys</h2>
          </CardTitle>
          <CardDescription>{keys.length} total.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {keys.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No keys yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-px text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-xs">{key.prefix}…</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((s) => (
                          <Badge key={s} variant="secondary">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {key.lastUsed ? new Date(key.lastUsed).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      {key.revokedAt ? (
                        <Badge variant="destructive">Revoked</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!key.revokedAt && (
                        <ActionButton
                          action={revokeApiKeyAction.bind(null, key.id)}
                          size="sm"
                          variant="outline"
                        >
                          Revoke
                        </ActionButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiKeysPage;
