import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".codex-remote-attachments/**",
      ".next/**",
      "tmp/**",
    ],
  },
  ...nextVitals,
  ...nextTs,
];

export default eslintConfig;
