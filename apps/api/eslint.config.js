import { config as baseConfig } from "@repo/eslint-config/base";

/**
 * @type {import("eslint").Linter.Config[]}
 *
 * Server-side linting. As in `apps/web`, the shared config declares no `files`
 * pattern, and in flat config ESLint only lints `.js` unless told otherwise, so
 * this app's `.ts` files would otherwise go unchecked. The babel parser is also
 * given the `typescript` plugin explicitly (Babel 8 dropped the old
 * `preset-typescript` switch that used to do it here).
 *
 * `no-undef` and `no-unused-vars` are left to `tsc` (`noUnusedLocals` is on in
 * this app) because the parser has no type information: it reports every
 * interface member and type-only reference as undefined or unused.
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
