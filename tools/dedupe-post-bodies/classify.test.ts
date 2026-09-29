import { dedupeBody, type DedupeResult } from "@repo/posts";
import { describe, expect, it } from "vitest";

import { classify, type Classified } from "./classify";
import type { Row } from "./report";

const P1 =
  "Reservar tempo para testes economiza retakes e ajuda o fotografo a escolher enquadramentos que favorecam seu look.";
const P2 =
  "Se quiser ensaiar em espacos que facilitam producao e iluminacao natural, procure locacoes com opcoes de cenario variadas.";
const P3 =
  "Praticar, fotografar e ajustar e a melhor forma de construir um guarda-roupa de fotos eficiente e consistente.";
const P4 =
  "Fotografe de perto e de corpo inteiro para avaliar se a meia atrai a atencao certa ou distrai do rosto do modelo.";
const P6 =
  "Teste uma foto com cada paleta em luz natural para confirmar qual cor levanta mais a expressao do rosto da modelo.";

const join = (...blocks: Array<string>): string => blocks.join("\n\n");

const closingStub = join(P1, P2, P3);

/** Two versions whose openings differ, so the final one does not hold P6: `dedupeBody` calls this `would-drop`. */
const supersededDraft = join(join(P6, closingStub), join(P4, closingStub));

/** One version stored three times, nothing lost between copies: the strict `exact` proof. */
const provable = join(closingStub, closingStub, closingStub);

const row = (body: string, overrides: Partial<Row> = {}): Row => ({
  body,
  id: "post-1",
  site: { domain: "exemplo.test" },
  siteId: "site-1",
  slug: "um-post",
  status: "PUBLISHED",
  ...overrides,
});

const buckets = (): Classified => ({
  acceptedSuperseded: [],
  nearMisses: [],
  needsReview: [],
  rejected: [],
  writable: [],
});

const WITHOUT_FLAG = { acceptSuperseded: false, dedupe: dedupeBody } as const;
const WITH_FLAG = { acceptSuperseded: true, dedupe: dedupeBody } as const;

const regressed =
  (over: Partial<DedupeResult>) =>
  (body: string): DedupeResult => ({ ...dedupeBody(body), ...over });

const FOREIGN_PROSE =
  "Uma secao inteira sobre licenciamento de trilhas sonoras que nao aparece em lugar nenhum do corpo original.";

describe("classify: the strict proof", () => {
  it("writes a row the final version provably covers", () => {
    const into = buckets();
    const written = classify([row(provable)], into, WITHOUT_FLAG);
    expect(written).toHaveLength(1);
    expect(into.writable).toHaveLength(1);
    expect(into.writable[0]?.method).toBe("exact");
    expect(written[0]?.after).toBe(closingStub);
  });

  it("keeps a strictly proven row on the strict path when the flag is on", () => {
    const into = buckets();
    const written = classify([row(provable)], into, WITH_FLAG);
    expect(written).toHaveLength(1);
    expect(into.writable).toHaveLength(1);
    expect(into.acceptedSuperseded).toEqual([]);
  });

  it("refuses a repair that is not a tail of the original", () => {
    const into = buckets();
    const written = classify([row(provable)], into, {
      acceptSuperseded: false,
      dedupe: regressed({ candidate: FOREIGN_PROSE }),
    });
    expect(written).toEqual([]);
    expect(into.rejected).toHaveLength(1);
    expect(into.writable).toEqual([]);
  });

  it("sorts an uncorrupt candidate row into near misses", () => {
    const into = buckets();
    const written = classify([row(join(P1, P2, P3, P2))], into, WITH_FLAG);
    expect(written).toEqual([]);
    expect(into.nearMisses).toHaveLength(1);
  });
});

describe("classify: --accept-superseded", () => {
  it("holds a would-drop row back when the flag is off", () => {
    const into = buckets();
    const written = classify([row(supersededDraft)], into, WITHOUT_FLAG);
    expect(written).toEqual([]);
    expect(into.needsReview).toHaveLength(1);
    expect(into.acceptedSuperseded).toEqual([]);
    expect(into.writable).toEqual([]);
  });

  it("writes a would-drop row when the flag is on", () => {
    const into = buckets();
    const written = classify([row(supersededDraft)], into, WITH_FLAG);
    expect(written).toHaveLength(1);
    expect(into.acceptedSuperseded).toHaveLength(1);
    expect(into.needsReview).toEqual([]);
    expect(into.writable).toEqual([]);
    expect(into.acceptedSuperseded[0]?.method).toBe("would-drop");
    expect(written[0]?.after).toBe(join(P4, closingStub));
  });

  it("still refuses a repair that is not a tail of the original, even with the flag", () => {
    const into = buckets();
    const written = classify([row(supersededDraft)], into, {
      acceptSuperseded: true,
      dedupe: regressed({ candidate: join(P4, FOREIGN_PROSE), method: "would-drop" }),
    });
    expect(written).toEqual([]);
    expect(into.rejected).toHaveLength(1);
    expect(into.acceptedSuperseded).toEqual([]);
  });

  it("keeps the dropped-block evidence on a row it admitted", () => {
    const into = buckets();
    classify([row(supersededDraft)], into, WITH_FLAG);
    const [accepted] = into.acceptedSuperseded;
    expect(accepted?.dropped.map((d) => d.block)).toEqual([P6]);
    expect(accepted?.dropped[0]?.closest).toBeDefined();
  });

  it("returns both proofs in one write batch, still filed apart", () => {
    const into = buckets();
    const written = classify(
      [row(provable, { id: "provado" }), row(supersededDraft, { id: "superado" })],
      into,
      WITH_FLAG,
    );
    expect(written.map((r) => r.postId)).toEqual(["provado", "superado"]);
    expect(into.writable.map((r) => r.postId)).toEqual(["provado"]);
    expect(into.acceptedSuperseded.map((r) => r.postId)).toEqual(["superado"]);
  });
});
