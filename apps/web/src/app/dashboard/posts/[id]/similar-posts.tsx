/**
 * Similar-posts card: driven by `Posts.findSimilar`. The pgvector
 * cosine query lives in `@repo/posts`; this Channel only renders.
 */
import { isAiConfigured } from "@repo/ai";
import * as Posts from "@repo/posts";
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
import { Sparkles } from "lucide-react";
import Link from "next/link";

import { IntegrationNotConfiguredCard } from "../../lib/provider-card";

const LIMIT = 5;

export const SimilarPostsCard = async ({ postId }: { postId: string }) => {
  if (!isAiConfigured()) {
    return (
      <IntegrationNotConfiguredCard
        feature="Find similar posts across your network"
        missing={["OPENAI_API_KEY"]}
        name="OpenAI"
      />
    );
  }
  if (!(await Posts.hasEmbedding(postId))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            Similar posts
          </CardTitle>
          <CardDescription>
            Embedding not yet computed. Republish or wait for the EMBED job to land.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const rows = await Posts.findSimilar(postId, LIMIT);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          Similar posts
        </CardTitle>
        <CardDescription>
          Top {LIMIT} cross-network matches by cosine similarity over OpenAi text embeddings. Useful
          for surfacing internal/PBN link candidates.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No other embedded posts yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Site</TableHead>
                <TableHead className="text-right">Similarity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link className="hover:underline" href={`/dashboard/posts/${r.id}`}>
                      {r.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.domain}</TableCell>
                  <TableCell className="text-right">
                    <SimilarityBadge value={r.similarity} />
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

const SimilarityBadge = ({ value }: { value: number }) => {
  const pct = (value * 100).toFixed(1);
  if (value >= 0.85) {
    return <Badge variant="default">{pct}%</Badge>;
  }
  if (value >= 0.7) {
    return <Badge variant="secondary">{pct}%</Badge>;
  }
  return <Badge variant="outline">{pct}%</Badge>;
};
