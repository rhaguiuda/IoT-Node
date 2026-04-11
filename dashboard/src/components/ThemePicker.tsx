"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES, DEFAULT_THEME } from "@/config/themes";

export default function ThemePicker() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>(DEFAULT_THEME);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with localStorage on mount (avoids SSR mismatch)
  useEffect(() => {
    const saved = localStorage.getItem("theme") ?? DEFAULT_THEME;
    setCurrentTheme(saved);
    if (saved === "dark") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  function selectTheme(themeId: string) {
    setCurrentTheme(themeId);
    if (themeId === "dark") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", themeId);
    }
    localStorage.setItem("theme", themeId);
    setIsOpen(false);
  }

  const activeDef = THEMES.find((t) => t.id === currentTheme) ?? THEMES[0];
  const darkThemes = THEMES.filter((t) => t.group === "dark");
  const lightThemes = THEMES.filter((t) => t.group === "light");

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
        style={{
          background: isOpen ? "var(--pill-active-bg)" : "var(--pill-bg)",
          color: isOpen ? "var(--accent-strong)" : "var(--text-secondary)",
          border: isOpen ? "1px solid var(--accent-border)" : "1px solid transparent",
        }}
      >
        <span
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: activeDef.accent }}
        />
        <span>{activeDef.label}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 z-50 rounded-xl shadow-lg max-h-80 overflow-y-auto min-w-[180px]"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Dark group */}
          <div className="text-[10px] uppercase tracking-wider px-3 py-1 mt-1" style={{ color: "var(--text-tertiary)" }}>
            Dark
          </div>
          {darkThemes.map((theme) => (
            <ThemeItem
              key={theme.id}
              theme={theme}
              active={currentTheme === theme.id}
              onSelect={selectTheme}
            />
          ))}

          {/* Light group */}
          <div className="text-[10px] uppercase tracking-wider px-3 py-1 mt-1" style={{ color: "var(--text-tertiary)" }}>
            Light
          </div>
          {lightThemes.map((theme) => (
            <ThemeItem
              key={theme.id}
              theme={theme}
              active={currentTheme === theme.id}
              onSelect={selectTheme}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ThemeItemProps {
  theme: { id: string; label: string; accent: string };
  active: boolean;
  onSelect: (id: string) => void;
}

function ThemeItem({ theme, active, onSelect }: ThemeItemProps) {
  return (
    <button
      onClick={() => onSelect(theme.id)}
      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors"
      style={{
        color: active ? "var(--accent-strong)" : "var(--text-primary)",
        borderLeft: active ? "2px solid var(--accent-border)" : "2px solid transparent",
        background: "transparent",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--table-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: theme.accent }}
      />
      <span className="flex-1">{theme.label}</span>
      {active && (
        <svg
          className="w-3 h-3 flex-shrink-0"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="2,6 5,9 10,3" />
        </svg>
      )}
    </button>
  );
}
