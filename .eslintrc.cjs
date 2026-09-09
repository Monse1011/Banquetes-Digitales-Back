module.exports = {
  root: true,

  env: {
    node: true,
    es2022: true,
  },

  parser: "@typescript-eslint/parser",

  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script",
  },

  plugins: ["@typescript-eslint"],

  extends: ["airbnb-base", "plugin:@typescript-eslint/recommended", "prettier"],

  settings: {
    "import/resolver": {
      typescript: {
        project: "./tsconfig.json",
      },
    },
  },

  rules: {
    // TypeScript
    "no-unused-vars": "off",

    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        vars: "all",
        args: "after-used",
        ignoreRestSiblings: true,
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],

    "@typescript-eslint/no-explicit-any": "warn",

    // Formatting
    indent: ["error", 2, { SwitchCase: 1 }],

    quotes: [
      "error",
      "single",
      {
        avoidEscape: true,
        allowTemplateLiterals: false,
      },
    ],

    semi: ["error", "always"],

    "max-len": [
      "error",
      {
        code: 100,
        tabWidth: 2,
        comments: 100,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      },
    ],

    // Naming
    camelcase: [
      "error",
      {
        properties: "never",
        ignoreDestructuring: false,
        ignoreImports: false,
        allow: ["^req$", "^res$", "^next$", "^id$", "^URL$", "^UUID$"],
      },
    ],

    // Imports
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        js: "never",
        jsx: "never",
        ts: "never",
        tsx: "never",
      },
    ],

    "import/no-unresolved": "error",
    "import/no-duplicates": "error",

    // Airbnb rules disabled because they conflict
    // with our TypeScript architecture
    "import/prefer-default-export": "off",
    "no-useless-constructor": "off",
    "no-empty-function": "off",
    "class-methods-use-this": "off",
    "lines-between-class-members": "off",
    "no-plusplus": "off",
    "no-nested-ternary": "off",
    "no-restricted-syntax": "off",
    "no-await-in-loop": "off",
    "prefer-template": "off",
    "consistent-return": "off",
    "default-case": "off",
    "max-params": "off",

    // Code quality
    "no-console": "error",
    "no-eval": "error",
    "no-new-func": "error",
    "no-implied-eval": "error",
    "no-throw-literal": "error",
    "prefer-promise-reject-errors": "error",

    complexity: ["warn", 10],

    "max-lines-per-function": [
      "warn",
      {
        max: 80,
        skipBlankLines: true,
        skipComments: true,
      },
    ],
  },

  overrides: [
    {
      files: ["**/*.test.ts", "**/*.spec.ts"],

      env: {
        node: true,
        es2022: true,
      },

      rules: {
        "no-console": "off",
        "max-lines-per-function": "off",
        "max-params": "off",
        "import/no-extraneous-dependencies": "off",
      },
    },
  ],

  ignorePatterns: [
    "node_modules/",
    "coverage/",
    "dist/",
    "build/",
    ".env",
    ".env.*",
  ],
};
