import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import type { ReactNode } from "react";
import { SkeletonBox, SkeletonSuspense } from "skullet/react";

export const CardSuspense = ({ children, title }: { children: ReactNode; title: string }) => (
  <SkeletonSuspense
    id={`card:${title}`}
    label={`Loading ${title}`}
    skeleton={
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{title}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SkeletonBox height={128} width="100%" />
        </CardContent>
      </Card>
    }
  >
    {children}
  </SkeletonSuspense>
);
