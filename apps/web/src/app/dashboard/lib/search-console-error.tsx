import { Plug } from "lucide-react";

import { ProviderErrorCard } from "./provider-card";

export const SearchConsoleError = ({ message, title }: { message: string; title: string }) => (
  <ProviderErrorCard
    description="Search Console unavailable."
    icon={Plug}
    message={message}
    title={title}
  />
);
