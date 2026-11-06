import type { ReactNode } from "react";

type LegalArticleProps = {
  children: ReactNode;
  title: string;
  updated: string;
};

const LegalArticle = ({ children, title, updated }: LegalArticleProps) => (
  <article className="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-24">
    <h1 className="text-4xl font-black tracking-display">{title}</h1>
    <p className="mt-3 text-sm text-muted-foreground">Updated {updated}</p>
    <div className="mt-8 space-y-5 leading-7 text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:pt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground">
      {children}
    </div>
  </article>
);

export { LegalArticle };
