import { describe, expect, it } from "vitest";

import { assertRewriteIsSane, RewriteOutputError } from "./guard";

const P1 =
  "Reservar tempo para testes economiza retakes e ajuda o fotografo a escolher enquadramentos que favorecam seu look.";
const P2 =
  "Se quiser ensaiar em espacos que facilitam producao e iluminacao natural, procure locacoes com opcoes de cenario variadas.";
const P3 =
  "Praticar, fotografar e ajustar e a melhor forma de construir um guarda-roupa de fotos eficiente e consistente.";

const article = [P1, P2, P3].join("\n\n");

const guard = (before: string, after: string) => (): void => {
  assertRewriteIsSane({ after, before, postId: "post_1" });
};

describe("assertRewriteIsSane", () => {
  it("accepts a normal rewrite", () => {
    expect(guard(article, `${P1}\n\n## Nova secao\n\n${P2}\n\n${P3}`)).not.toThrow();
  });

  it("accepts a rewrite that shortens the body", () => {
    expect(guard(article, P1)).not.toThrow();
  });

  it("rejects a model that echoed its input and appended a rewrite", () => {
    expect(guard(article, `${article}\n\n${article}`)).toThrow(RewriteOutputError);
  });

  it("rejects the compounding case that produced the 21.8 MB body", () => {
    const doubled = `${article}\n\n${article}`;
    expect(guard(doubled, `${doubled}\n\n${doubled}`)).toThrow(/echoed its input/v);
  });

  it("rejects a body that grew past the length ceiling without repeating a block", () => {
    const long = Array.from(
      { length: 24 },
      (_, i) =>
        `Paragrafo original numero ${i} com texto suficiente para contar como bloco substancial de prosa.`,
    ).join("\n\n");
    const inflated = Array.from(
      { length: 90 },
      (_, i) =>
        `Paragrafo inflado numero ${i} com texto suficiente para contar como bloco substancial de prosa.`,
    ).join("\n\n");
    expect(guard(long, inflated)).toThrow(/ceiling/v);
  });

  it("lets a short migration stub grow into a real article", () => {
    const stub = "Um stub curto herdado da migracao do WordPress, com poucas frases.";
    const grown = Array.from(
      { length: 20 },
      (_, i) =>
        `Paragrafo novo numero ${i} com texto suficiente para contar como bloco substancial de prosa.`,
    ).join("\n\n");
    expect(guard(stub, grown)).not.toThrow();
  });

  it("still rejects a duplicated body even when it is short", () => {
    const short = [P1, P2].join("\n\n");
    expect(guard(short, `${short}\n\n${short}`)).toThrow(/echoed its input/v);
  });

  it("does not divide by zero on an empty original body", () => {
    expect(guard("", article)).not.toThrow();
  });
});
