import { config as baseConfig } from "@repo/eslint-config/base";

/**
 * @type {import("eslint").Linter.Config[]}
 *
 * Same reasoning as the other apps: name the `.ts` files explicitly and leave
 * `no-undef` / `no-unused-vars` to `tsc`, which has the type information.
 */
export default [
  ...baseConfig,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          parserOpts: { plugins: ["typescript"] },
        },
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      // Node globals used by the duel smoke script.
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },
];
