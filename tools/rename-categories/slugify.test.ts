import { describe, expect, it } from "vitest";

import { slugify } from "../_shared/slugify";

/**
 * Every tool in this sweep renames stored text only where the slug is unchanged,
 * so these cases are the safety claim itself: if slugify drifts from the theme's,
 * a rename the tools call safe would move an indexed page.
 */
describe("slugify", () => {
  it("strips accents rather than dropping the letter", () => {
    expect(slugify("Áudio")).toBe("audio");
    expect(slugify("Vídeo")).toBe("video");
    expect(slugify("Arquitetura")).toBe("arquitetura");
  });

  it("renders the English and Portuguese name of a pair to the same slug", () => {
    expect(slugify("Audio")).toBe(slugify("Áudio"));
    expect(slugify("Videography")).not.toBe(slugify("Videografia"));
  });

  it("collapses the tag variants that differ only in case, accent or a hash", () => {
    const variants = ["producaodevideo", "#produçãodevídeo", "#ProduçãoDeVídeo"];
    expect(new Set(variants.map(slugify))).toEqual(new Set(["producaodevideo"]));
  });

  it("joins words on a single dash and trims the edges", () => {
    expect(slugify("Real Estate")).toBe("real-estate");
    expect(slugify("São Paulo")).toBe("sao-paulo");
    expect(slugify("  Estilo  de   Vida  ")).toBe("estilo-de-vida");
    expect(slugify("--Moda--")).toBe("moda");
  });

  it("drops punctuation instead of leaving it in the URL", () => {
    expect(slugify("Food & Drink")).toBe("food-drink");
    expect(slugify("Imóveis: Guia")).toBe("imoveis-guia");
  });
});
