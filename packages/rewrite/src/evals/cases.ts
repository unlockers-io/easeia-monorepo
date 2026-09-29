import type { SiteLanguage } from "@repo/db";

export type EvalLanguage = "en" | "pt" | "es";

/** A case's language stands in for the site's, so the prompt has a target to write in. */
export const EVAL_LANGUAGE_TO_SITE = {
  en: "EN",
  es: "ES",
  pt: "PT",
} satisfies Record<EvalLanguage, SiteLanguage>;

export type EvalAssertion = {
  description: string;
};

export type EvalCase = {
  assertions: ReadonlyArray<EvalAssertion>;
  body: string;
  excerpt: string | null;
  focusKeyword: string | null;
  id: string;
  language: EvalLanguage;
  sweep:
    | "clarity"
    | "voice-tone"
    | "so-what"
    | "prove-it"
    | "specificity"
    | "heightened-emotion"
    | "zero-risk";
  title: string;
};

const EN_CASES: ReadonlyArray<EvalCase> = [
  {
    assertions: [
      {
        description:
          "Rewritten body no longer uses 'leverage', 'utilize', 'cutting-edge', or 'seamless'.",
      },
      {
        description: "Each feature mentioned is followed by a 'which means…' style benefit bridge.",
      },
      {
        description: "Opening sentence answers the post's title question directly within 25 words.",
      },
    ],
    body: "Welcome to CloudSync! We are very excited to offer you an innovative, cutting-edge platform that seamlessly integrates with your existing tools. Our powerful solution helps businesses of all sizes optimize their workflows and drive meaningful results. Get started today and experience the difference!",
    excerpt: null,
    focusKeyword: "cloud sync",
    id: "en-clarity-cloudsync",
    language: "en",
    sweep: "clarity",
    title: "Welcome to CloudSync",
  },
  {
    assertions: [
      {
        description:
          "Vague claims ('great', 'works well') are replaced with at least one concrete metric or named outcome.",
      },
      {
        description:
          "If specifics are unavailable in the source, the rewrite softens the claim instead of fabricating numbers.",
      },
    ],
    body: "CloudSync is great! It really helped our company. The team was very responsive and the product works well. We would recommend it to anyone looking for a solution.",
    excerpt: null,
    focusKeyword: null,
    id: "en-prove-it-testimonial",
    language: "en",
    sweep: "prove-it",
    title: "Why teams choose CloudSync",
  },
];

const PT_CASES: ReadonlyArray<EvalCase> = [
  {
    assertions: [
      {
        description:
          "O corpo reescrito não usa 'comprehensive', 'robust', 'seamless' ou suas traduções literais ('abrangente', 'robusto', 'sem atrito').",
      },
      {
        description:
          "Redundâncias do tipo 'planejar, executar e monitorar do início ao fim' foram cortadas.",
      },
      { description: "O texto final é pelo menos 40% mais curto que a entrada." },
    ],
    body: "Nossa solução abrangente de gerenciamento de projetos oferece às equipes um conjunto robusto de ferramentas que permite planejar, executar e monitorar seus projetos do início ao fim de forma eficiente. Com nossa interface intuitiva, painel poderoso de análises e capacidades de integração sem atrito, você pode garantir que cada aspecto do seu projeto seja gerenciado com precisão e cuidado. Seja você uma pequena startup ou uma grande empresa, nossa plataforma escala para atender suas necessidades únicas, ajudando você a entregar projetos no prazo e dentro do orçamento todas as vezes.",
    excerpt: null,
    focusKeyword: "gerenciamento de projetos",
    id: "pt-specificity-product-description",
    language: "pt",
    sweep: "specificity",
    title: "Plataforma de gerenciamento de projetos",
  },
  {
    assertions: [
      {
        description:
          "A reescrita preserva o português brasileiro do original; nenhuma palavra-chave técnica é traduzida para o inglês.",
      },
      {
        description:
          "O 'so what' de cada feature listada é explicitado em uma frase curta logo após a feature.",
      },
      {
        description:
          "A chamada para ação informa o próximo passo concreto, não termos genéricos como 'saiba mais' ou 'clique aqui'.",
      },
    ],
    body: "O plano Pro inclui projetos ilimitados, relatórios avançados, suporte prioritário e integrações personalizadas. A partir de R$ 99 por mês. Saiba mais.",
    excerpt: null,
    focusKeyword: "plano pro",
    id: "pt-so-what-pricing",
    language: "pt",
    sweep: "so-what",
    title: "Plano Pro do Acme Studios",
  },
];

const ES_CASES: ReadonlyArray<EvalCase> = [
  {
    assertions: [
      {
        description:
          "El cuerpo reescrito mantiene el español del original; no aparecen frases en inglés salvo nombres propios.",
      },
      {
        description:
          "Frases vacías como 'lleva tu negocio al siguiente nivel' o 'profesionales dedicados' son eliminadas.",
      },
      {
        description:
          "La CTA final usa un verbo de acción específico, no 'haz clic aquí' ni 'más información'.",
      },
    ],
    body: "¿Listo para llevar tu negocio al siguiente nivel? Nuestro equipo de profesionales dedicados está disponible para ayudarte a alcanzar tus objetivos. Haz clic aquí para obtener más información sobre cómo podemos ayudarte a tener éxito.",
    excerpt: null,
    focusKeyword: null,
    id: "es-voice-tone-cta",
    language: "es",
    sweep: "voice-tone",
    title: "Lleva tu negocio al siguiente nivel",
  },
  {
    assertions: [
      {
        description:
          "El testimonio reescrito reemplaza adjetivos vacíos ('genial', 'funciona bien') con un resultado o un contexto concreto.",
      },
      {
        description:
          "Si la fuente no aporta cifras, la reescritura las omite en lugar de inventarlas.",
      },
      {
        description:
          "El nombre y rol del testimoniante se conservan tal cual aparecen en la entrada.",
      },
    ],
    body: "¡CloudSync es genial! Ayudó mucho a nuestra empresa. El equipo respondió rápido y el producto funciona bien. Lo recomendaríamos a cualquiera que busque una solución. - Juana P., CEO",
    excerpt: null,
    focusKeyword: null,
    id: "es-prove-it-testimonial",
    language: "es",
    sweep: "prove-it",
    title: "Por qué los equipos eligen CloudSync",
  },
];

export const EVAL_CASES: ReadonlyArray<EvalCase> = [...EN_CASES, ...PT_CASES, ...ES_CASES];
