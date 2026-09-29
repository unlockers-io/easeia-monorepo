import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent } from "@repo/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { ExternalLink } from "lucide-react";

export const RewrittenBadge = ({ rewrittenAt }: { rewrittenAt: Date | null }) => {
  if (!rewrittenAt) {
    return <span className="text-xs text-muted-foreground">Not yet rewritten</span>;
  }
  return <Badge variant="secondary">Rewritten {new Date(rewrittenAt).toLocaleString()}</Badge>;
};

export type MoneySiteLink = { anchorText: string; id: string; toUrl: string };

export const MoneySiteLinksPanel = ({
  links,
  moneySiteDomain,
}: {
  links: Array<MoneySiteLink>;
  moneySiteDomain: string | null;
}) => {
  if (moneySiteDomain === null || moneySiteDomain === "") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">No money site configured for this site.</p>
        </CardContent>
      </Card>
    );
  }
  if (links.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">No money-site links yet.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Anchor text</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="text-right">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id}>
                <TableCell className="text-sm">{link.anchorText}</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                  {link.toUrl}
                </TableCell>
                <TableCell className="text-right">
                  <a
                    className="inline-flex items-center gap-1 text-xs hover:underline"
                    href={link.toUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="size-3" />
                    View
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
