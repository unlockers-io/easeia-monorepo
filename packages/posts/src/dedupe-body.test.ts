import { describe, expect, it } from "vitest";

import { analyzeBody, dedupeBody, splitBlocks } from "./dedupe-body";

const P1 =
  "Reservar tempo para testes economiza retakes e ajuda o fotografo a escolher enquadramentos que favorecam seu look.";
const P2 =
  "Se quiser ensaiar em espacos que facilitam producao e iluminacao natural, procure locacoes com opcoes de cenario variadas.";
const P3 =
  "Praticar, fotografar e ajustar e a melhor forma de construir um guarda-roupa de fotos eficiente e consistente.";
const P4 =
  "Fotografe de perto e de corpo inteiro para avaliar se a meia atrai a atencao certa ou distrai do rosto do modelo.";
const P5 =
  "Preparacao reduz erros no dia: organize looks numerados, leve kit de costura e faca uma rapida prova com a camera.";
const P6 =
  "Teste uma foto com cada paleta em luz natural para confirmar qual cor levanta mais a expressao do rosto da modelo.";

const H2 = "## Rotina pratica antes de um ensaio fotografico";
const H3 = "### Como usar meias aparentes e detalhes pequenos";

const join = (...blocks: Array<string>): string => blocks.join("\n\n");

/**
 * The production shape: successive versions of one article, oldest first, each
 * built by prepending a section to the previous version's closing stub.
 */
const closingStub = join(P1, P2, P3);
const version2 = join(P4, H2, P5, closingStub);
const version3 = join(P6, H3, version2);

describe("splitBlocks", () => {
  it("splits on blank lines and drops the whitespace", () => {
    expect(splitBlocks(`${P1}\n\n\n  \n${P2}`)).toEqual([P1, P2]);
  });

  it("keeps a fenced code block whole even when it contains a blank line", () => {
    const fenced = "```ts\nconst a = 1;\n\nconst b = 2;\n```";
    expect(splitBlocks(`${P1}\n\n${fenced}\n\n${P2}`)).toEqual([P1, fenced, P2]);
  });

  it("returns nothing for an empty body", () => {
    expect(splitBlocks("   \n\n  ")).toEqual([]);
  });
});

describe("analyzeBody", () => {
  it("reports a clean article as clean", () => {
    const analysis = analyzeBody(version3);
    expect(analysis.isCorrupt).toBe(false);
    expect(analysis.duplicatedSubstantial).toBe(0);
    expect(analysis.maxRepeat).toBe(1);
  });

  it("counts duplicated substantial blocks, not duplicated blocks", () => {
    const analysis = analyzeBody(join(P1, "24 fps", P2, "24 fps", P3, "24 fps"));
    expect(analysis.maxRepeat).toBe(3);
    expect(analysis.duplicatedSubstantial).toBe(0);
    expect(analysis.isCorrupt).toBe(false);
  });

  it("flags a body stored twice", () => {
    const analysis = analyzeBody(join(version2, version2));
    expect(analysis.isCorrupt).toBe(true);
  });
});

describe("dedupeBody: corruption", () => {
  it("repairs the 2,559-times case down to a single clean article", () => {
    const body = Array.from({ length: 2559 }, () => closingStub).join("\n\n");
    const result = dedupeBody(body);
    expect(result.changed).toBe(true);
    expect(result.method).toBe("exact");
    expect(result.text).toBe(closingStub);
    expect(result.analysis.maxRepeat).toBe(2559);
  });

  it("recovers the final version from concatenated growing versions", () => {
    const body = join(closingStub, closingStub, version2, version2, version3);
    const result = dedupeBody(body);
    expect(result.method).toBe("exact");
    expect(result.text).toBe(version3);
  });

  it("repairs the mild 3-times case", () => {
    const result = dedupeBody(join(version2, version2, version2));
    expect(result.changed).toBe(true);
    expect(result.text).toBe(version2);
  });

  it("scales to the worst production row without losing a paragraph", () => {
    const versions = [
      ...Array.from({ length: 29 }, () => closingStub),
      ...Array.from({ length: 57 }, () => version2),
      ...Array.from({ length: 3975 }, () => version3),
    ];
    const result = dedupeBody(versions.join("\n\n"));
    expect(result.text).toBe(version3);
    expect(result.removedBlocks).toBeGreaterThan(20_000);
  });

  it("classifies a section inserted mid-article as superset, not exact", () => {
    const earlier = join(P4, closingStub);
    const later = join(P4, H2, P5, closingStub);
    const result = dedupeBody(join(earlier, later));
    expect(result.method).toBe("superset");
    expect(result.changed).toBe(true);
    expect(result.dropped).toEqual([]);
    expect(splitBlocks(result.text)).toEqual(splitBlocks(later));
  });

  it("refuses to write when a superseded version holds prose the final one does not", () => {
    const oldOpening = join(P6, closingStub);
    const newOpening = join(P4, closingStub);
    const result = dedupeBody(join(oldOpening, newOpening));
    expect(result.method).toBe("would-drop");
    expect(result.changed).toBe(false);
    expect(result.text).toBe(join(oldOpening, newOpening));
    expect(result.dropped.map((d) => d.block)).toEqual([P6]);
  });

  it("still reports what the repair would have been, so the row can be ranked", () => {
    const body = join(join(P6, closingStub), join(P4, closingStub));
    const result = dedupeBody(body);
    expect(result.candidate).toBe(join(P4, closingStub));
    expect(result.candidate.length).toBeLessThan(body.length);
  });

  it("marks a dropped block as superseded when a survivor is a rewrite of it", () => {
    const draft =
      "Escolha roupas que comuniquem uma unica ideia principal por look e ajuste o contraste.";
    const rewritten =
      "Escolha roupas que comuniquem uma unica ideia principal por look, e ajuste bem o contraste.";
    const result = dedupeBody(join(join(draft, closingStub), join(rewritten, closingStub)));
    expect(result.method).toBe("would-drop");
    const [dropped] = result.dropped;
    expect(dropped?.superseded).toBe(true);
    expect(dropped?.closest).toBe(rewritten);
    expect(dropped?.similarity).toBeGreaterThan(0.5);
  });

  it("marks a dropped block as having no counterpart when nothing resembles it", () => {
    const orphan =
      "Uma secao inteira sobre licenciamento de trilhas sonoras que nao aparece em nenhum outro lugar.";
    const result = dedupeBody(join(join(orphan, closingStub), join(P4, closingStub)));
    expect(result.method).toBe("would-drop");
    const [dropped] = result.dropped;
    expect(dropped?.superseded).toBe(false);
    expect(dropped?.closest).toBeDefined();
  });

  it("is idempotent: repairing a repaired body is a no-op", () => {
    const once = dedupeBody(join(version3, version3, version3));
    const twice = dedupeBody(once.text);
    expect(twice.changed).toBe(false);
    expect(twice.text).toBe(once.text);
  });
});

describe("dedupeBody: content that repeats legitimately", () => {
  it("leaves a size-conversion table alone", () => {
    const table = join(
      "## Guia de tamanhos",
      P1,
      "S",
      "M",
      "L",
      "86-90",
      "90-94",
      "S",
      "M",
      "L",
      "86-90",
      "90-94",
      P2,
    );
    const result = dedupeBody(table);
    expect(result.changed).toBe(false);
    expect(result.text).toBe(table);
  });

  it("leaves a repeated refrain alone", () => {
    const refrain = "Grave, escute, ajuste.";
    const body = join(P1, refrain, P2, refrain, P3, refrain, P4);
    expect(dedupeBody(body).changed).toBe(false);
  });

  it("leaves a repeated code line alone", () => {
    const line = "```bash\nffmpeg -i in.mov out.mp4\n```";
    const body = join(P1, line, P2, line, P3, line);
    expect(dedupeBody(body).changed).toBe(false);
  });

  it("leaves one repeated substantial paragraph alone, below the threshold", () => {
    const result = dedupeBody(join(P1, P2, P3, P2));
    expect(result.changed).toBe(false);
    expect(result.analysis.duplicatedSubstantial).toBe(1);
  });

  it("leaves a normal article alone", () => {
    const result = dedupeBody(version3);
    expect(result.changed).toBe(false);
    expect(result.removedBlocks).toBe(0);
  });

  it("leaves an empty body alone", () => {
    expect(dedupeBody("").changed).toBe(false);
  });
});
