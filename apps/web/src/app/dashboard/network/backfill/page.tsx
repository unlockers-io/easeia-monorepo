"use client";

import { readBackfillStatusAction, startBackfillAction } from "../actions";
import { RunPanel } from "../run-panel";

const Page = () => (
  <RunPanel
    description="Classifies and embeds every published post, then writes suggested internal + PBN links for review."
    loadStatus={readBackfillStatusAction}
    pollMs={3000}
    queryKey="backfill-status"
    rows={(counts) => [
      { done: counts.classifiedPosts, label: "Classify (posts)", total: counts.posts },
      { done: counts.embeddedPosts, label: "Embed (posts)", total: counts.posts },
      { done: counts.suggestDone, label: "Suggest links (posts)", total: counts.posts },
    ]}
    runLabel="Run network backfill"
    start={startBackfillAction}
    title="Network backfill"
  />
);

export default Page;
