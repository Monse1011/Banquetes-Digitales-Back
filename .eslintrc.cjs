module.exports = {
  root: true,

  env: {
    node: true,
    es2022: true,
  },

  ignorePatterns: ["vitest.config.js"],

  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "commonjs",
  },

  extends: ["airbnb-base", "prettier"],

  plugins: ["check-file"],

  rules: {
    indent: ["error", 2, { SwitchCase: 1 }],

    quotes: [
      "error",
      "double",
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

    camelcase: [
      "error",
      {
        properties: "never",
        ignoreDestructuring: false,
        ignoreImports: false,
        allow: ["^req$", "^res$", "^next$", "^id$", "^URL$", "^UUID$"],
      },
    ],

    "check-file/filename-naming-convention": [
      "error",
      {
        "**/*.js": "KEBAB_CASE",
      },
      {
        ignoreMiddleExtensions: true,
        errorMessage: 'El archivo "{{ target }}" debe utilizar kebab-case. Ejemplo: user-status.js',
      },
    ],

    "import/extensions": "off",
    "import/no-unresolved": "off",
    "import/no-duplicates": "error",

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

    "no-console": "off",
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
    "no-unused-vars": [
      "error",
      {
        vars: "all",
        args: "after-used",
        argsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
  },

  overrides: [
    {
      files: ["**/*.test.js", "**/*.spec.js"],
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
      rules: {
        "no-console": "off",
        "max-lines-per-function": "off",
        "max-params": "off",
        "import/no-extraneous-dependencies": "off",
      },
    },
  ],
};
