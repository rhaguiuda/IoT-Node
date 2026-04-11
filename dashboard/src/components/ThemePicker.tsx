"use client";

import { useEffect, useState } from "react";
import { THEMES, DEFAULT_THEME } from "@/config/themes";

export default function ThemePicker() {
  const [currentTheme, setCurrentTheme] = useState<string>(DEFAULT_THEME);

  useEffect(() => {
    const saved = localStorage.getItem("theme") ?? DEFAULT_THEME;
    setCurrentTheme(saved);
    if (saved === "dark") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const themeId = e.target.value;
    setCurrentTheme(themeId);
    if (themeId === "dark") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", themeId);
    }
    localStorage.setItem("theme", themeId);
  }

  const darkThemes = THEMES.filter((t) => t.group === "dark");
  const lightThemes = THEMES.filter((t) => t.group === "light");

  return (
    <select
      value={currentTheme}
      onChange={handleChange}
      className="text-xs font-medium rounded-lg px-2.5 py-1.5 cursor-pointer outline-none"
      style={{
        background: "var(--bg-tertiary)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      <optgroup label="Dark">
        {darkThemes.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </optgroup>
      <optgroup label="Light">
        {lightThemes.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </optgroup>
    </select>
  );
}
