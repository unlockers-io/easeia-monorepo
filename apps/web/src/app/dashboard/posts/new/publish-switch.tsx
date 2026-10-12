"use client";

import { Switch } from "@repo/ui/components/switch";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";

const PublishSwitch = () => {
  const ready = useClientReady();

  return <Switch disabled={!ready} id="publish" name="publish" value="on" />;
};

export { PublishSwitch };
