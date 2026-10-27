import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config(
   {
      ignores: ['eslint.config.mjs', '**/src/generated/**', 'dist/**', 'coverage/**', '**/.next/**', '**/*.mjs'],
   },
   eslint.configs.recommended,
   ...tseslint.configs.recommendedTypeChecked,
   eslintPluginPrettierRecommended,
   {
      languageOptions: {
         globals: {
            ...globals.node,
            ...globals.jest,
         },
         sourceType: 'commonjs',
         parserOptions: {
            projectService: true,
            tsconfigRootDir: import.meta.dirname,
         },
      },
      plugins: {
         'unused-imports': unusedImports,
      },
   },
   {
      rules: {
         // Unused imports & variables prevention
         'unused-imports/no-unused-imports': 'error',
         'unused-imports/no-unused-vars': [
            'error',
            {
               vars: 'all',
               varsIgnorePattern: '^_',
               args: 'after-used',
               argsIgnorePattern: '^_',
            },
         ],
         '@typescript-eslint/no-unused-vars': 'off', // Handled strictly by unused-imports

         // Promise & async safety
         '@typescript-eslint/no-floating-promises': 'error',
         '@typescript-eslint/await-thenable': 'error',
         '@typescript-eslint/no-misused-promises': [
            'error',
            {
               checksVoidReturn: false, // Allows async event handlers / express route handlers
            },
         ],

         // Type safety
         '@typescript-eslint/no-explicit-any': 'warn',
         '@typescript-eslint/no-unsafe-argument': 'warn',
         '@typescript-eslint/no-unsafe-assignment': 'warn',
         '@typescript-eslint/no-unsafe-member-access': 'warn',
         '@typescript-eslint/no-unsafe-call': 'warn',
         '@typescript-eslint/no-unsafe-return': 'warn',

         // Code hygiene & best practices
         eqeqeq: ['error', 'always'],
         'no-console': ['warn', { allow: ['warn', 'error'] }],
         'prettier/prettier': ['error', { endOfLine: 'auto' }],
      },
   },
   // More permissive rule overrides specifically for test files where mock assertions & loose typing are common
   {
      files: ['**/*.spec.ts', '**/*.test.ts', 'test/**/*.ts'],
      rules: {
         '@typescript-eslint/no-explicit-any': 'off',
         '@typescript-eslint/no-unsafe-argument': 'off',
         '@typescript-eslint/no-unsafe-assignment': 'off',
         '@typescript-eslint/no-unsafe-member-access': 'off',
         '@typescript-eslint/no-unsafe-call': 'off',
         '@typescript-eslint/no-unsafe-return': 'off',
         '@typescript-eslint/unbound-method': 'off',
      },
   },
   // Permissive console output for database seeds and standalone utility scripts
   {
      files: ['**/seed.ts', 'scripts/**/*.ts'],
      rules: {
         'no-console': 'off',
      },
   },
);
