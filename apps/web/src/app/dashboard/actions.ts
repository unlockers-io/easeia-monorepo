"use server";

import * as Sites from "@repo/sites";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/access";
import { withAuth } from "@/lib/server-action";

export const refreshSnapshotsAction = async () =>
  withAuth(async () => {
    await Sites.requestSnapshots();
    await audit({ action: "snapshot.refresh", target: "network" });
    revalidatePath("/dashboard");
  });
