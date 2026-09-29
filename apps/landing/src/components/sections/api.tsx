import type { ReactNode } from "react";

import { Section } from "@/components/section";

const ApiBullet = ({ children }: { children: ReactNode }) => (
  <li className="border-t border-border py-2 text-sm font-semibold">{children}</li>
);

const Api = () => {
  return (
    <Section
      id="api"
      intro={
        <>
          <p>
            One bearer token, one endpoint, full publish lifecycle. No wrangling per-site
            credentials from the consumer side.
          </p>
          <ul className="mt-6 border-b border-border text-foreground">
            <ApiBullet>OpenAPI schema at /openapi.json, interactive reference at /docs</ApiBullet>
            <ApiBullet>Scoped keys: posts:write, sites:read, jobs:read, content:read</ApiBullet>
            <ApiBullet>Job IDs returned synchronously; status via /api/jobs/:id</ApiBullet>
            <ApiBullet>HTTP-native: no SDK required</ApiBullet>
          </ul>
        </>
      }
      no="04"
      title="Pipe posts in from N8N, your CI, or a Slack bot."
    >
      <div className="overflow-hidden bg-foreground text-sm text-background">
        <div className="flex items-center justify-between gap-4 border-b border-background/20 px-4 py-2.5 text-xs font-bold">
          <span className="font-mono">POST /api/posts</span>
          <span className="text-background/60">Public API</span>
        </div>
        <section aria-label="API request example">
          <pre className="p-5 font-mono text-(length:--text-label) leading-6 whitespace-pre-wrap">
            <code>{`curl "$EASEIA_API_URL/api/posts" \\
  -H "Authorization: Bearer $EASEIA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "siteId": "ckxx…",
    "slug": "wedding-photography-tips",
    "title": "10 Tips for Wedding Photography",
    "body": "## Intro\\n\\nPost bodies are Markdown.",
    "focusKeyword": "wedding photography",
    "tags": ["weddings", "tips"],
    "publish": true
  }'

# → 201 Created
# {
#   "data": { "id": "ck…", "status": "SCHEDULED", … },
#   "job":  { "id": "ck…" }
# }`}</code>
          </pre>
        </section>
      </div>
    </Section>
  );
};

export { Api };
