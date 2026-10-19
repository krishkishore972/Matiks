import { config as baseConfig } from "@repo/eslint-config/base";

/**
 * @type {import("eslint").Linter.Config[]}
 *
 * Same reasoning as `apps/web` and `apps/api`: the shared config declares no
 * `files` pattern, so TypeScript files have to be named explicitly or ESLint
 * silently ignores them. `no-undef` / `no-unused-vars` are left to `tsc`, which
 * has the type information this parser does not.
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
];
