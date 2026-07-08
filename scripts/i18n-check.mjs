import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceFiles = [
  "components/auth-form.tsx",
  "components/portfolio-app.tsx",
  "components/mobile-portfolio-app.tsx",
  "components/wallet-tracker.tsx",
  "components/wallet-connect.tsx",
  "components/holdings-import.tsx",
  "components/theme-toggle.tsx",
  "components/tradingview-widget.tsx",
  "lib/calculations.ts",
];
const locales = ["zh", "es", "ja", "ko"];

const translationSource = fs.readFileSync(path.join(root, "lib/translations.ts"), "utf8");
const overrides = JSON.parse(fs.readFileSync(path.join(root, "lib/translation-overrides.json"), "utf8"));
const marker = "export const phraseTranslations: Record<NonEnglishLocale, Record<string, string>> = ";
const start = translationSource.indexOf(marker) + marker.length;
const end = translationSource.lastIndexOf(" as const;");
const translations = JSON.parse(translationSource.slice(start, end));

const keys = new Set();
for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const matches = source.matchAll(/tx\(\s*locale\s*,\s*"([^"]+)"/g);
  for (const match of matches) keys.add(match[1]);
}

const missing = [];
const guarded = [];
function isPlaceholderTranslation(value, key) {
  return !value || value === key || /^(Sin traducir|未翻訳|번역 필요):/.test(value);
}

for (const key of keys) {
  for (const locale of locales) {
    const value = overrides[locale]?.[key] ?? translations[locale]?.[key];
    if (!value) missing.push(`${locale}: ${key}`);
    else if (isPlaceholderTranslation(value, key)) guarded.push(`${locale}: ${key}`);
  }
}

if (missing.length) {
  console.error("Missing i18n translations:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

if (guarded.length) {
  console.warn("i18n guard will replace untranslated UI strings at runtime:");
  for (const item of guarded.slice(0, 80)) console.warn(`- ${item}`);
  if (guarded.length > 80) console.warn(`...and ${guarded.length - 80} more`);
}

console.log(`i18n check passed: ${keys.size} UI keys have ${locales.length + 1} locales.`);
