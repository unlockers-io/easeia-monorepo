import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";
import shadcn from "oxlint-config-awesomeness/shadcn";

export default defineConfig({
  extends: [awesomeness, shadcn],
  // Generated runtime is byte-verified and tested in the control plane.
  ignorePatterns: [".github/ci/*.mjs"],
  overrides: [
    {
      files: ["packages/ui/src/lib/utils.test.ts"],
      rules: {
        "shadcn/no-unknown-classes": [
          "error",
          {
            allow: ["foo", "bar", "baz"],
          },
        ],
      },
    },
    {
      files: [
        "apps/web/src/proxy.ts",
        "apps/web/src/lib/auth-helpers.ts",
        "packages/auth/src/server.ts",
      ],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: [
        "apps/web/src/app/dashboard/posts/posts-table.tsx",
        "apps/web/src/app/dashboard/sites/sites-table.tsx",
      ],
      rules: {
        "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
      },
    },
    {
      files: ["tools/**/*.ts"],
      rules: {
        "no-use-before-define": "off",
        "promise/prefer-await-to-then": "off",
        "unicorn/prefer-top-level-await": "off",
      },
    },
    {
      files: ["apps/api/src/index.ts", "apps/worker/src/index.ts"],
      rules: {
        "unicorn/no-process-exit": "off",
      },
    },
    {
      files: ["packages/ui/src/components/*.tsx"],
      rules: {
        "jsx-a11y/label-has-associated-control": "off",
        "no-use-before-define": "off",
        "perfectionist/sort-jsx-props": "off",
        "perfectionist/sort-objects": "off",
      },
    },
    {
      files: ["packages/*/src/errors.ts"],
      rules: {
        "max-classes-per-file": "off",
      },
    },
    {
      files: ["apps/web/src/app/**/*.tsx"],
      rules: {
        "no-use-before-define": "off",
      },
    },
  ],
  rules: {
    "shadcn/no-restyle": [
      "error",
      {
        allow: ["layout"],
        contracts: [
          {
            allow: ["layout", "typography"],
            deny: ["font-*"],
            pattern: "^CardTitle$",
          },
          {
            allow: ["layout", "spacing"],
            pattern: "^CardContent$",
          },
          {
            allow: ["layout", "typography", "gap-*"],
            deny: ["font-*"],
            pattern: "^CardTitle$",
          },
          {
            allow: ["layout", "gap-*"],
            pattern: "^CardHeader$",
          },
          {
            allow: ["layout", "gap-*"],
            pattern: "^DialogTitle$",
          },
          {
            allow: ["layout", "spacing"],
            pattern: "^(FieldGroup|TableHead)$",
          },
          {
            allow: ["layout", "spacing", "typography", "text-muted-foreground"],
            pattern: "^TableCell$",
          },
          {
            allow: ["layout", "bg-card"],
            pattern: "^TableHeader$",
          },
          {
            allow: ["layout", "text-xl"],
            pattern: "^Logo$",
          },
        ],
      },
    ],
  },
  settings: { shadcn: { ui: "@repo/ui/components" } },
});
