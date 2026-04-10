export interface ThemeDef {
  id: string;
  label: string;
  group: "dark" | "light";
  accent: string;
}

export const THEMES: ThemeDef[] = [
  { id: "dark",             label: "FitBark Dark",      group: "dark",  accent: "#2eccc0" },
  { id: "monokai",          label: "Monokai",           group: "dark",  accent: "#a6e22e" },
  { id: "dracula",          label: "Dracula",           group: "dark",  accent: "#bd93f9" },
  { id: "nord",             label: "Nord",              group: "dark",  accent: "#88c0d0" },
  { id: "solarized",        label: "Solarized Dark",    group: "dark",  accent: "#b58900" },
  { id: "onedark",          label: "One Dark",          group: "dark",  accent: "#61afef" },
  { id: "github",           label: "GitHub Dark",       group: "dark",  accent: "#58a6ff" },
  { id: "catppuccin",       label: "Catppuccin Mocha",  group: "dark",  accent: "#cba6f7" },
  { id: "light",            label: "FitBark Light",     group: "light", accent: "#2eccc0" },
  { id: "solarized-light",  label: "Solarized Light",   group: "light", accent: "#268bd2" },
  { id: "github-light",     label: "GitHub Light",      group: "light", accent: "#0969da" },
  { id: "catppuccin-latte", label: "Catppuccin Latte",  group: "light", accent: "#8839ef" },
  { id: "nord-light",       label: "Nord Light",        group: "light", accent: "#5e81ac" },
  { id: "rosepine-dawn",    label: "Rose Pine Dawn",    group: "light", accent: "#d7827e" },
];

export const DEFAULT_THEME = "dark";
