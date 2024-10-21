import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import eslintConfigPrettier from "eslint-config-prettier";

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "error",
      // begin block of things we're either entirely ignoring or switching to warnings.
      // these largely need to be fixed (as many "unsafe" things as possible at least.)
      // and the warnings are TBD.
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/ban-tslint-comment": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-inferrable-types": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/prefer-for-of": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/dot-notation": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-duplicate-type-constituents": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/await-thenable": "warn",
      "no-empty-pattern": "warn",
      "no-prototype-builtins": "warn",
      "no-var": "off",
      "prefer-const": "off",
      "prefer-spread": "warn",
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      // we have a lot of these in graphql generated code
      reportUnusedDisableDirectives: false,
    }
  },
  {
    ignores: [
      "packages/shared/**/*",
      "packages/protocol/**/*",
      "packages/replay-next/**/*",
    ],
  }
  // eslintConfigPrettier,
  // eslintPluginPrettierRecommended,
);


// module.exports = [
//   {
//     files: ["**/*.ts", "**/*.tsx"],
//     languageOptions: {
//       parser: typescriptEslintParser,
//     },
//   },
//   {
//     rules: {
//       "@typescript-eslint/explicit-module-boundary-types": "error",
//     }
//   },
//   eslintConfigPrettier,
//   eslintPluginPrettierRecommended,
// ];
