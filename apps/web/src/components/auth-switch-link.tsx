import Link from "next/link";
import { type ReactNode, Suspense, use } from "react";

import { safeRedirectPath } from "@/lib/redirect-validation";

type Props = {
  children: ReactNode;
  href: "/login" | "/register";
  searchParams: Promise<{ from?: string }>;
};

const LINK_CLASS = "text-foreground underline underline-offset-4";

const ForwardingLink = ({ children, href, searchParams }: Props) => {
  const safeTo = safeRedirectPath(use(searchParams).from);

  return (
    <Link
      className={LINK_CLASS}
      href={safeTo === "/dashboard" ? href : `${href}?from=${encodeURIComponent(safeTo)}`}
    >
      {children}
    </Link>
  );
};

export const AuthSwitchLink = (props: Props) => (
  <Suspense
    fallback={
      <Link className={LINK_CLASS} href={props.href}>
        {props.children}
      </Link>
    }
  >
    <ForwardingLink {...props} />
  </Suspense>
);
