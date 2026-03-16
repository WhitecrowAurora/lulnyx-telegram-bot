import { parseCookies } from "../webAuth.js";

export function getUiPrefs(req) {
  const cookies = parseCookies(req.headers.cookie);
  const accept = String(req.headers["accept-language"] || "").toLowerCase();
  const fallbackLang = accept.includes("zh") ? "zh" : "en";
  const lang = cookies.ui_lang === "zh" ? "zh" : cookies.ui_lang === "en" ? "en" : fallbackLang;
  const theme = cookies.ui_theme === "light" ? "light" : cookies.ui_theme === "dark" ? "dark" : "dark";
  return { lang, theme };
}

