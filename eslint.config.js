import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

export default [
  {
    // Half of src/ was outside every glob, so `eslint src/lib/foo.js` printed
    // nothing and read exactly like a clean file. Verified 2026-08-07 by adding
    // a reference to an undefined variable in src/lib and watching eslint stay
    // silent. A linter that cannot see a file is not a gate on it.
    files: [
      "src/components/**/*.{js,mjs,cjs,jsx}",
      "src/pages/**/*.{js,mjs,cjs,jsx}",
      "src/lib/**/*.{js,mjs,cjs,jsx}",
      "src/hooks/**/*.{js,mjs,cjs,jsx}",
      "src/utils/**/*.{js,mjs,cjs,jsx}",
      "src/entities/**/*.{js,mjs,cjs,jsx}",
      "src/Layout.jsx",
    ],
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      // src/lib and src/utils are shared with Node-side scripts (PDF export,
      // the journey harness), so a deliberate `Buffer` fallback next to a
      // `btoa` browser path is correct code, not an undefined variable.
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      // `...pluginJs.configs.recommended` above supplies a `rules` object, and
      // this key REPLACES it wholesale rather than merging — which silently
      // dropped `no-undef`. On 2026-08-07 that let a reference to an undefined
      // `titleRef` reach a committed file: lint was clean, the build was clean,
      // and it would have thrown on every book creation. In a codebase with no
      // TypeScript, this rule is the only thing standing between a renamed
      // variable and a runtime crash. It is restored explicitly so that
      // re-ordering the spread cannot quietly remove it again.
      "no-undef": "error",
      "no-unused-vars": "off",
      "react/jsx-uses-vars": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
    },
  },
];
