import * as Sites from "@repo/sites";
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
import Link from "next/link";

const LIMIT = 50;

export const InboundLinksCard = async ({ siteId }: { siteId: string }) => {
  const links = await Sites.inboundLinks(siteId, LIMIT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Inbound link footprint</h2>
        </CardTitle>
        <CardDescription>
          Cross-site (PBN) links pointing into this Site, newest first.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {links.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No inbound network links yet.</p>
        ) : (
          <div className="max-h-112 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Anchor</TableHead>
                  <TableHead>To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">
                      <Link className="hover:underline" href={`/dashboard/posts/${l.fromPost.id}`}>
                        {l.fromPost.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{l.fromPost.site.domain}</div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {l.anchorText || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.toPost ? (
                        <Link className="hover:underline" href={`/dashboard/posts/${l.toPost.id}`}>
                          {l.toPost.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
