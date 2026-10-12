import { closeJobs } from "@repo/jobs";
import { requestRedeploy } from "@repo/sites";

export const redeploySites = async (siteIds: Iterable<string>): Promise<void> => {
  const unique = [...new Set(siteIds)];
  console.log(`\nredeploy requests (${unique.length} sites)`);
  for (const siteId of unique) {
    const outcome = await requestRedeploy(siteId);
    console.log(`  ${outcome.padEnd(15)} ${siteId}`);
  }
  await closeJobs();
};
