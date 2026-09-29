import { describe, expect, it } from "vitest";

import { STRIP_RULES, stripEmDash } from "./strip-em-dash";

const EM = "\u2014";
const EN = "\u2013";
const NBSP = "\u00a0";

const out = (input: string, kind?: "markdown" | "text" | "title"): string =>
  stripEmDash(input, kind).text;

describe("stripEmDash", () => {
  it("reports a count for every rule, so no rule can go unreported", () => {
    const { counts } = stripEmDash("nada aqui");
    expect(Object.keys(counts).toSorted()).toEqual([...STRIP_RULES].toSorted());
  });

  it("leaves copy without the glyph untouched and reports no change", () => {
    const clean = "Producao musical: conheca as cinco etapas e aplique checklists.";
    const result = stripEmDash(clean, "markdown");
    expect(result.changed).toBe(false);
    expect(result.text).toBe(clean);
  });

  describe("paired appositive", () => {
    it("wraps a spaced pair in parentheses", () => {
      expect(
        out(
          `Liste tres tomadas essenciais ${EM} luz dura, luz difusa, neon ${EM} e calcule o tempo.`,
        ),
      ).toBe("Liste tres tomadas essenciais (luz dura, luz difusa, neon) e calcule o tempo.");
    });

    it("wraps an unspaced pair in parentheses rather than doubling commas", () => {
      expect(
        out(
          `copia detalhes do cinema${EM}silhuetas, cores, acessorios${EM}e os adapta ao uso diario.`,
        ),
      ).toBe("copia detalhes do cinema (silhuetas, cores, acessorios) e os adapta ao uso diario.");
    });

    it("does not orphan punctuation that already follows the closing dash", () => {
      expect(
        out(`exige mais infraestrutura ${EM} amplificador e efeitos ${EM}, mas facilita.`),
      ).toBe("exige mais infraestrutura (amplificador e efeitos), mas facilita.");
    });

    it("keeps a decimal inside the interior from ending the clause", () => {
      expect(
        out(
          `Monte um kit base ${EM} camera, lapela e uma estacao de 1.000 Wh ${EM} e teste perto.`,
        ),
      ).toBe("Monte um kit base (camera, lapela e uma estacao de 1.000 Wh) e teste perto.");
    });

    it("treats dashes split by a semicolon as two singles, not a pair", () => {
      expect(out(`dia 1 ${EM} cenas internas; dia 2 ${EM} externas diurnas.`)).toBe(
        "dia 1: cenas internas; dia 2: externas diurnas.",
      );
    });

    it("reports the rule that fired", () => {
      const result = stripEmDash(
        `o conjunto ${EM} camera, lente e suporte ${EM} afeta o resultado.`,
      );
      expect(result.counts["paired-appositive"]).toBe(1);
    });
  });

  describe("single dash", () => {
    it("turns a short label into a colon", () => {
      expect(out(`Manha ${EM} checagem de luz natural.`)).toBe("Manha: checagem de luz natural.");
    });

    it("turns an enumeration into a colon", () => {
      expect(out(`detalhes sonoros importam ${EM} passos, ziperes, tecido movimentado.`)).toBe(
        "detalhes sonoros importam: passos, ziperes, tecido movimentado.",
      );
    });

    it("turns an appended qualifier into a comma even after a short head", () => {
      expect(
        out(`corta tempo de montagem ${EM} por isso recomendo espacos com identidade visual.`),
      ).toBe("corta tempo de montagem, por isso recomendo espacos com identidade visual.");
    });

    it("turns an appositive noun phrase into a comma", () => {
      expect(
        out(`Um video demonstra tamanho e movimento ${EM} informacoes que fotos nao dao.`),
      ).toBe("Um video demonstra tamanho e movimento, informacoes que fotos nao dao.");
    });

    it("turns an unspaced dash into a comma plus a space", () => {
      expect(out(`priorizar narrativa e controle${EM}mesmo com pouco orcamento.`)).toBe(
        "priorizar narrativa e controle, mesmo com pouco orcamento.",
      );
    });

    it("does not stack a separator on terminal punctuation", () => {
      expect(out(`Objetivo: tecnica ou portfolio? ${EM} defina antes de comparar cursos.`)).toBe(
        "Objetivo: tecnica ou portfolio? defina antes de comparar cursos.",
      );
    });

    it("does not double a separator the head already has", () => {
      expect(out(`Royal Estudio, ${EM} que tem sala tratada.`)).toBe(
        "Royal Estudio, que tem sala tratada.",
      );
    });

    it("drops a dangling dash at the end of a line", () => {
      expect(out(`Reserve o bloco de testes ${EM}`)).toBe("Reserve o bloco de testes");
    });

    it("handles a non-breaking space around the dash", () => {
      expect(out(`Tarde${NBSP}${EM}${NBSP}tomadas criativas e trocas de look.`)).toBe(
        "Tarde: tomadas criativas e trocas de look.",
      );
    });
  });

  describe("titles", () => {
    it("separates a subtitle with a colon", () => {
      expect(out(`Tendencias em Design de Interiores Comerciais ${EM} Guia 2026`, "title")).toBe(
        "Tendencias em Design de Interiores Comerciais: Guia 2026",
      );
    });

    it("falls back to the prose rules when the head already has a colon", () => {
      expect(
        out(`Guia rapido: som em locacao ${EM} microfones, cabos e monitoracao`, "title"),
      ).toBe("Guia rapido: som em locacao (microfones, cabos e monitoracao)");
    });
  });

  describe("numeric ranges", () => {
    it("uses an en-dash between digits with no spaces", () => {
      expect(out(`sessoes de 10${EM}20 minutos.`)).toBe(`sessoes de 10${EN}20 minutos.`);
    });

    it("does not treat a spaced label like Bloco 1 as a range", () => {
      expect(out(`Bloco 1 ${EM} 3 horas de gravacao.`)).toBe("Bloco 1: 3 horas de gravacao.");
    });
  });

  describe("markdown safety", () => {
    it("leaves a fenced code block alone", () => {
      const md = [
        `Rode o comando ${EM} ele grava o log.`,
        "",
        "```bash",
        `ffmpeg -i in.wav out.wav # traco ${EM} preservado`,
        "```",
      ].join("\n");
      const result = stripEmDash(md, "markdown");
      expect(result.text).toContain(`# traco ${EM} preservado`);
      expect(result.text).toContain("Rode o comando: ele grava o log.");
      expect(result.text.split("```")).toHaveLength(3);
    });

    it("leaves an inline code span alone", () => {
      const md = `Use \`a ${EM} b\` como flag ${EM} o parser aceita.`;
      expect(out(md, "markdown")).toBe(`Use \`a ${EM} b\` como flag: o parser aceita.`);
    });

    it("keeps a link destination intact and still rewrites the prose after it", () => {
      const md = `[Loja conceito](https://exemplo.com/a-b) ${EM} prateleiras e manequins ajudam.`;
      expect(out(md, "markdown")).toBe(
        "[Loja conceito](https://exemplo.com/a-b): prateleiras e manequins ajudam.",
      );
    });

    it("rewrites link text but not the URL", () => {
      const md = `Veja o [dossie de locacao ${EM} versao 2026](https://exemplo.com/guia) hoje.`;
      expect(out(md, "markdown")).toBe(
        "Veja o [dossie de locacao, versao 2026](https://exemplo.com/guia) hoje.",
      );
    });

    it("does not read a thematic break as front matter", () => {
      const md = [
        `Intro do texto.`,
        ``,
        `---`,
        ``,
        `#### Secao 1`,
        ``,
        `A diferenca de sensor ${EM} os numeros mostram o alcance real.`,
      ].join("\n");
      const result = stripEmDash(md, "markdown");
      expect(result.text).not.toContain(EM);
      expect(result.text).toContain("A diferenca de sensor: os numeros mostram o alcance real.");
    });

    it("leaves front matter alone", () => {
      const md = [
        `---`,
        `title: Guia ${EM} 2026`,
        `---`,
        ``,
        `Corpo do texto ${EM} segue aqui.`,
      ].join("\n");
      const result = stripEmDash(md, "markdown");
      expect(result.text).toContain(`title: Guia ${EM} 2026`);
      expect(result.text).toContain("Corpo do texto: segue aqui.");
    });

    it("does not merge separate paragraphs", () => {
      const md = `Manha ${EM} luz natural.\n\nTarde ${EM} luz artificial.`;
      expect(out(md, "markdown")).toBe("Manha: luz natural.\n\nTarde: luz artificial.");
    });

    it("keeps list markers and rewrites each item", () => {
      const md = `- Estrutura ${EM} paredes, teto e pisos\n- Acesso ${EM} carga e descarga`;
      expect(out(md, "markdown")).toBe(
        "- Estrutura: paredes, teto e pisos\n- Acesso: carga e descarga",
      );
    });
  });

  describe("one colon per sentence", () => {
    it("wraps the list in parentheses when the sentence already has a colon", () => {
      expect(
        out(
          `Pos-producao de audio: passos praticos para cortar tempo ate 50% ${EM} templates, batch processing e entrega.`,
        ),
      ).toBe(
        "Pos-producao de audio: passos praticos para cortar tempo ate 50% (templates, batch processing e entrega).",
      );
    });

    it("closes the parenthesis at the clause end, not the end of the value", () => {
      expect(
        out(
          `Compare WAV e OGG: escolha entre arquivos comprimidos e sem perdas segundo o uso ${EM} edicao, arquivamento ou streaming. Depois exporte tudo.`,
        ),
      ).toBe(
        "Compare WAV e OGG: escolha entre arquivos comprimidos e sem perdas segundo o uso (edicao, arquivamento ou streaming). Depois exporte tudo.",
      );
    });

    it("falls back to a comma when the blocked tail is not an enumeration", () => {
      expect(out(`Guia rapido: som em locacao ${EM} microfones sem fio bastam`)).toBe(
        "Guia rapido: som em locacao, microfones sem fio bastam",
      );
    });

    it("does not block on a colon in a previous sentence", () => {
      expect(out(`Equipe minima: tres pessoas. Manha ${EM} checagem de luz natural.`)).toBe(
        "Equipe minima: tres pessoas. Manha: checagem de luz natural.",
      );
    });

    it("does not treat a clock time as the sentence colon", () => {
      expect(out(`07:00${EN}08:00 ${EM} chegada da equipe e montagem.`)).toBe(
        `07:00${EN}08:00: chegada da equipe e montagem.`,
      );
    });

    it("does not treat a ratio as the sentence colon", () => {
      expect(out(`Regra 1:2 ${EM} uma copia local e outra na nuvem.`)).toBe(
        "Regra 1:2: uma copia local e outra na nuvem.",
      );
    });

    it("does not count the colon inside a URL", () => {
      const md = `Veja [o guia](https://exemplo.com/a) ${EM} fotos, medidas e plantas do espaco.`;
      expect(out(md, "markdown")).toBe(
        "Veja [o guia](https://exemplo.com/a): fotos, medidas e plantas do espaco.",
      );
    });

    it("blocks on a colon behind the dash, not just ahead of it", () => {
      expect(out(`09:00${EN}11:30 ${EM} Looks 1 e 2: planos medios e detalhes.`)).toBe(
        `09:00${EN}11:30, Looks 1 e 2: planos medios e detalhes.`,
      );
    });

    it("blocks when only the tail holds the colon", () => {
      expect(
        out(
          `Meca o nivel de ruido com um medidor SPL ${EM} alvo pratico: menos de 40 dB(A) para locucao, menos de 50 dB(A) com ambiente.`,
        ),
      ).toBe(
        "Meca o nivel de ruido com um medidor SPL, alvo pratico: menos de 40 dB(A) para locucao, menos de 50 dB(A) com ambiente.",
      );
    });

    it("counts a colon with a digit on only one side as prose", () => {
      expect(out(`Bloco A ${EM} Looks 1 e 2: planos medios.`)).toBe(
        "Bloco A, Looks 1 e 2: planos medios.",
      );
    });

    it("still ignores a colon in a following sentence", () => {
      expect(out(`Manha ${EM} checagem de luz. Tarde: tomadas criativas.`)).toBe(
        "Manha: checagem de luz. Tarde: tomadas criativas.",
      );
    });

    it("still ignores a URL colon in a plain-text excerpt", () => {
      expect(out(`Guia completo ${EM} veja https://exemplo.com/a antes de fechar.`)).toBe(
        "Guia completo, veja https://exemplo.com/a antes de fechar.",
      );
    });

    it("does not swallow a second dash when the blocked tail is too long to pair", () => {
      const long =
        "luz, som, camera, tripe, gimbal, lentes, filtros, baterias, cartoes de memoria, refletores, rebatedores e cabos para o dia inteiro de gravacao na locacao alugada";
      const result = stripEmDash(`Plano: bloco um ${EM} ${long} ${EM} fim.`);
      expect(result.text).toBe(`Plano: bloco um, ${long}, fim.`);
      expect(result.counts["enumeration-parenthetical"]).toBe(0);
    });
  });

  describe("never nests parentheses", () => {
    it("uses commas for a pair whose interior already has parentheses", () => {
      expect(
        out(
          `escolha arranjo e mixagem ${EM} incluindo o fader (controle de volume) da mesa ${EM} e ajuste o timbre.`,
        ),
      ).toBe(
        "escolha arranjo e mixagem, incluindo o fader (controle de volume) da mesa, e ajuste o timbre.",
      );
    });

    it("uses commas for a pair sitting inside an open parenthesis", () => {
      expect(
        out(
          `Locacao artistica (uso de espacos ${EM} galerias, atelies, residencias ${EM} como cenario) traz cenografia pronta.`,
        ),
      ).toBe(
        "Locacao artistica (uso de espacos, galerias, atelies, residencias, como cenario) traz cenografia pronta.",
      );
    });

    it("falls back to a comma when the blocked list already holds parentheses", () => {
      expect(
        out(
          `Use mapas de calor: identifique duas zonas ${EM} luz direta (postes) e sombra profunda (fachadas).`,
        ),
      ).toBe(
        "Use mapas de calor: identifique duas zonas, luz direta (postes) e sombra profunda (fachadas).",
      );
    });

    it("does not wrap across a parenthesis the dash sits inside", () => {
      expect(out(`Titulo (ex.: Ensaio Documental ${EM} Rio de Janeiro, 2024) segue.`)).toBe(
        "Titulo (ex.: Ensaio Documental, Rio de Janeiro, 2024) segue.",
      );
    });

    it("answers after a bare label with a comma, not a parenthesised answer", () => {
      expect(
        out(
          `Resposta direta: Sim ${EM} voce pode filmar a noite se controlar a luz, o ISO e a autorizacao.`,
        ),
      ).toBe(
        "Resposta direta: Sim, voce pode filmar a noite se controlar a luz, o ISO e a autorizacao.",
      );
    });
  });

  describe("clause tails", () => {
    it("uses a colon when the tail is an independent clause", () => {
      expect(
        out(`o microfone rejeita sons laterais${EM}cardioide costuma ser a escolha pratica.`),
      ).toBe("o microfone rejeita sons laterais: cardioide costuma ser a escolha pratica.");
    });

    it("uses a colon for an unspaced dash joining a clause", () => {
      expect(
        out(`controla ganho e qualidade${EM}modelos como o Scarlett 2i2 sao opcoes comuns.`),
      ).toBe("controla ganho e qualidade: modelos como o Scarlett 2i2 sao opcoes comuns.");
    });

    it("keeps a comma when the tail is only a phrase", () => {
      expect(out(`priorizar narrativa e controle${EM}mesmo com pouco orcamento.`)).toBe(
        "priorizar narrativa e controle, mesmo com pouco orcamento.",
      );
    });

    it("keeps a comma for an appositive noun phrase", () => {
      expect(
        out(`Uma visita tecnica revela ruidos e fluxo ${EM} detalhes que fotos nao mostram.`),
      ).toBe("Uma visita tecnica revela ruidos e fluxo, detalhes que fotos nao mostram.");
    });

    it("uses a semicolon when the sentence has already spent its colon", () => {
      expect(
        out(
          `Resposta direta: o espaco atende bem a producao ${EM} muitos projetos pedem gerador de 30 kVA.`,
        ),
      ).toBe(
        "Resposta direta: o espaco atende bem a producao; muitos projetos pedem gerador de 30 kVA.",
      );
    });

    it("treats an imperative as a clause", () => {
      expect(out(`Planeje ciclos curtos ${EM} publique uma peca a cada duas semanas.`)).toBe(
        "Planeje ciclos curtos: publique uma peca a cada duas semanas.",
      );
    });

    it("does not read a proper noun as the verb it looks like", () => {
      expect(
        out(
          `O guia reune locacoes para moda sustentavel ${EM} lista de espacos uteis em São Paulo.`,
        ),
      ).toBe("O guia reune locacoes para moda sustentavel, lista de espacos uteis em São Paulo.");
    });

    it("does not read a verb inside a subordinate clause as the main verb", () => {
      expect(
        out(
          `A galeria transforma obras e roupas em dialogo ${EM} util quando a peça precisa aparecer.`,
        ),
      ).toBe(
        "A galeria transforma obras e roupas em dialogo, util quando a peça precisa aparecer.",
      );
    });

    it("reads a noun/imperative homograph as a noun away from the tail start", () => {
      expect(
        out(`Manha ${EM} montagem: confirmar planta, rede eletrica, teste rapido de som.`),
      ).toBe("Manha, montagem: confirmar planta, rede eletrica, teste rapido de som.");
    });

    it("reads the same homograph as an imperative when it opens the tail", () => {
      expect(out(`Publique em horarios ativos ${EM} teste dias uteis no fim do dia.`)).toBe(
        "Publique em horarios ativos: teste dias uteis no fim do dia.",
      );
    });

    it("leaves connector tails as commas", () => {
      expect(out(`corta tempo de montagem ${EM} por isso recomendo espacos com identidade.`)).toBe(
        "corta tempo de montagem, por isso recomendo espacos com identidade.",
      );
    });
  });

  describe("idempotency", () => {
    it("is a no-op on its own output", () => {
      const md = [
        `Liste tres tomadas ${EM} luz dura, luz difusa, neon ${EM} e calcule o tempo.`,
        `Manha ${EM} checagem de luz.`,
        `controle${EM}mesmo com pouco orcamento.`,
        "```",
        `codigo ${EM} intacto`,
        "```",
      ].join("\n");
      const once = stripEmDash(md, "markdown");
      const twice = stripEmDash(once.text, "markdown");
      expect(twice.changed).toBe(false);
      expect(twice.text).toBe(once.text);
    });
  });
});
