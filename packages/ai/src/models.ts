export const MODELS = {
  embedding: {
    dimensions: 1536,
    microUsdPerInputToken: 0.02,
    name: "text-embedding-3-small",
  },
  image: {
    microUsdPerInputToken: 5,
    microUsdPerOutputToken: 30,
    name: "gpt-image-2",
    size: "1536x1024",
  },
  text: {
    microUsdPerInputToken: 0.4,
    microUsdPerOutputToken: 1.8,
    name: "gpt-5.6-luna",
  },
} as const;
