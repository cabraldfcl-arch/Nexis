import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".next-analyze/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
