import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Table, TableBody, TableCell, TableRow } from "@repo/ui/components/table";
import { TableColumns } from "@repo/ui/compositions/table-columns";
import Link from "next/link";

type OutboundLink = {
  anchorText: string;
  id: string;
  position: number | null;
  toPost: { id: string; slug: string; title: string } | null;
  toUrl: string;
  type: "INTERNAL" | "PBN" | "EXTERNAL";
};

export const OutboundLinksCard = ({ outbound }: { outbound: Array<OutboundLink> }) => {
  const counts = outbound.reduce<Record<OutboundLink["type"], number>>(
    (acc, l) => {
      acc[l.type] += 1;
      return acc;
    },
    { EXTERNAL: 0, INTERNAL: 0, PBN: 0 },
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Outbound links</h2>
        </CardTitle>
        <CardDescription>
          {outbound.length === 0
            ? "Crawled on every successful publish."
            : `${counts.INTERNAL} internal · ${counts.PBN} PBN · ${counts.EXTERNAL} external`}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {outbound.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            No links yet. Publish to trigger the crawl.
          </p>
        ) : (
          <Table>
            <TableColumns
              columns={[
                { label: "Type" },
                { label: "Anchor" },
                { label: "Target" },
                { className: "text-right", label: "#" },
              ]}
            />
            <TableBody>
              {outbound.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <LinkTypeBadge type={l.type} />
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    {l.anchorText || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm">
                    {l.toPost ? (
                      <Link className="hover:underline" href={`/dashboard/posts/${l.toPost.id}`}>
                        {l.toPost.title}
                      </Link>
                    ) : (
                      <a
                        className="text-muted-foreground hover:underline"
                        href={l.toUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {l.toUrl}
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {l.position ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

const LinkTypeBadge = ({ type }: { type: OutboundLink["type"] }) => {
  if (type === "INTERNAL") {
    return <Badge variant="outline">Internal</Badge>;
  }
  if (type === "PBN") {
    return <Badge variant="default">PBN</Badge>;
  }
  return <Badge variant="secondary">External</Badge>;
};
