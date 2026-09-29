import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export const ProviderErrorCard = ({
  description,
  icon: Icon,
  message,
  title,
}: {
  description: ReactNode;
  icon?: LucideIcon;
  message: string;
  title: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        {title}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-xs text-destructive">{message}</p>
    </CardContent>
  </Card>
);

export const IntegrationNotConfiguredCard = ({
  feature,
  missing,
  name,
}: {
  feature: string;
  missing: ReadonlyArray<string>;
  name: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>
        <h2>{name} is not configured</h2>
      </CardTitle>
      <CardDescription>{feature}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      <p>Set {missing.join(" and ")} on this server to enable it.</p>
      <Link className="underline underline-offset-4" href="/dashboard/settings#integrations">
        View integration settings
      </Link>
    </CardContent>
  </Card>
);
