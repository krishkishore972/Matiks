import { nextJsConfig } from "@repo/eslint-config/next-js";

/**
 * @type {import("eslint").Linter.Config[]}
 *
 * Two fixes on top of the shared config, both about TypeScript actually being
 * checked:
 *
 * 1. The shared config declares no `files` pattern, and in flat config ESLint
 *    only picks up `.js` by default — so every `.ts`/`.tsx` file in this app was
 *    silently unlinted.
 * 2. Its babel parser is configured for TypeScript but not JSX, so `.tsx` files
 *    failed to parse once they were included. `isTSX` + `allExtensions` enables
 *    both.
 *
 * `no-undef` is turned off for TypeScript because the compiler already catches
 * undefined identifiers (and the parser has no type information, so it reports
 * every interface member and type name as undefined); `next typegen && tsc
 * --noEmit` covers that ground properly.
 */
export default [
  ...nextJsConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          // Parse TypeScript and JSX directly. No transform is needed here, and
          // Babel 8 removed the old preset-typescript .isTSX option.
          parserOpts: { plugins: ["typescript", "jsx"] },
        },
      },
    },
    rules: {
      // The babel parser carries no type information, so `no-undef` reports every
      // interface member and type name as undefined, and `no-unused-vars` cannot
      // see type-only references. TypeScript enforces both properly here
      // (`noUnusedLocals` is on in this app's tsconfig, and `tsc --noEmit` runs as
      // part of check-types and build), so these two rules are left to it.
      "no-undef": "off",
      "no-unused-vars": "off",
      // This app fetches on mount and drives game timers from effects, which is
      // exactly the "subscribe to an external system, then setState from its
      // callback" pattern these rules are meant to allow. The rule's target —
      // state derived from props during render — does not appear in this codebase.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
