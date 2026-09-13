import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint 9 Flat Configuration
 * Integrates Next.js Core Web Vitals and TypeScript rules with architectural boundary restrictions.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,

  // Global ignore patterns
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "next-env.d.ts",
      "*.log",
    ],
  },

  // Rule 1: UI Purity - src/components/ui/ must not import from src/server/ or src/features/
  {
    files: ["src/components/ui/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server",
                "@/server/**",
                "**/server",
                "**/server/**",
                "../server/**",
                "../../server/**",
                "../**/server/**",
                "@/features",
                "@/features/**",
                "**/features",
                "**/features/**",
                "../features/**",
                "../../features/**",
                "../**/features/**",
              ],
              message:
                "UI purity violation: Presentation components under src/components/ui/ must not import from src/server/ or src/features/.",
            },
          ],
        },
      ],
    },
  },

  // Rule 2: Feature Isolation - src/features/ must not import sibling features directly
  {
    files: ["src/features/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features", "@/features/**", "@/features/*/**"],
              message:
                "Feature isolation violation: Direct cross-feature imports between sibling modules in src/features/ are forbidden. Use shared abstractions under src/lib/ or relative imports within the same feature.",
            },
            {
              group: ["../*/*", "../../*/*", "../../../**"],
              message:
                "Feature isolation violation: Deep relative imports escaping feature boundaries are prohibited. Cross-feature access must go through src/lib/.",
            },
          ],
        },
      ],
    },
  },

  // Relax unused-vars in test files
  {
    files: ["tests/**/*.{js,mjs,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

export default eslintConfig;
