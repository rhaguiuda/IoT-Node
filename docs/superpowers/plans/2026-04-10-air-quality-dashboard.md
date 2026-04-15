# Air Quality Dashboard Implementation Plan

> **⚠️ HISTORICAL DOCUMENT — STATUS UPDATE 2026-04-15**
>
> This plan originally targeted a multi-sensor node (SCD41 + SHT4x + ENS160 + BH1750) reporting CO₂, temperature, humidity, TVOC, AQI, eCO₂ and Lux.
>
> **The extra sensors (SHT4x, ENS160, BH1750) were removed from the hardware** because they were unreliable in testing. The shipped system has only the **Sensirion SCD41**, reporting **CO₂, temperature and humidity**.
>
> Any references in this plan to SHT4x, ENS160, BH1750, TVOC, AQI, eCO₂ or Lux are obsolete and should be ignored. The canonical description of the current system lives in `README.md` and `docs/superpowers/specs/2026-04-10-air-quality-dashboard-design.md`. This file is kept as a record of the original implementation path.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page real-time air quality dashboard with historical data, 14 themes, and Pushover alerts.

**Architecture:** Next.js 16 single-page app reads real-time data via MQTT WebSocket from EMQX broker and historical data from SQLite via API Routes. A Node.js collector process subscribes to MQTT topics and persists readings to SQLite, also handling Pushover alert dispatch. Both services share a SQLite volume and deploy as Docker containers on Bee-Docker.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Recharts, motion, mqtt.js, better-sqlite3, lucide-react, Docker Compose.

**Design Spec:** `docs/superpowers/specs/2026-04-10-air-quality-dashboard-design.md`

**Theme Source:** `/Users/rodrigohaguiuda/Documents/FitBark/fb_v5_debug_terminal/styles.css` (14 themes, lines 9-390)

**FitBark UI Guidelines:** `/Users/rodrigohaguiuda/Documents/FitBark/fitbark_developer_dashboard/docs/ui-guidelines.md`

**IMPORTANT:** Use the `frontend-design` skill when implementing UI components (Tasks 6-14) for design quality and polish.

**IMPORTANT:** Read `node_modules/next/dist/docs/` after installing dependencies — Next.js 16 has breaking changes from prior versions.

---

## File Structure

```
IoT-Node/
├── firmware/                         ← existing PlatformIO (moved from root)
│   ├── src/main.cpp
│   ├── platformio.ini
│   └── ...
├── dashboard/                        ← NEW: Next.js app + collector
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── globals.css           ← 14 theme definitions
│   │   │   ├── page.tsx              ← single page dashboard
│   │   │   └── api/
│   │   │       ├── telemetry/
│   │   │       │   └── route.ts
│   │   │       └── settings/
│   │   │           └── route.ts
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── KpiCard.tsx
│   │   │   ├── KpiGrid.tsx
│   │   │   ├── ThemePicker.tsx
│   │   │   ├── RangeSelector.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── animation/
│   │   │   │   ├── AnimateIn.tsx
│   │   │   │   ├── StaggerChildren.tsx
│   │   │   │   └── CountUp.tsx
│   │   │   └── charts/
│   │   │       ├── ChartTooltip.tsx
│   │   │       ├── Co2Chart.tsx
│   │   │       ├── TempHumChart.tsx
│   │   │       ├── TvocChart.tsx
│   │   │       └── LuxChart.tsx
│   │   ├── lib/
│   │   │   ├── mqtt.ts
│   │   │   ├── db.ts
│   │   │   ├── thresholds.ts
│   │   │   └── types.ts
│   │   └── config/
│   │       ├── sensors.ts
│   │       ├── themes.ts
│   │       └── ranges.ts
│   ├── collector/
│   │   ├── index.ts
│   │   ├── db.ts
│   │   ├── alerts.ts
│   │   └── tsconfig.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── Dockerfile
│   └── docker-compose.yml
├── docs/
├── README.md
└── .gitignore
```

---

## Task 1: Restructure repo and scaffold Next.js project

**Files:**
- Move: root PlatformIO files → `firmware/`
- Create: `dashboard/package.json`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/next.config.ts`
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Move firmware files into `firmware/` subdirectory**

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node
mkdir -p firmware
# Move PlatformIO project files
mv src firmware/
mv platformio.ini firmware/
mv include firmware/
mv lib firmware/
mv test firmware/
mv .vscode firmware/
```

Verify: `ls firmware/` should show `src/ platformio.ini include/ lib/ test/ .vscode/`

- [ ] **Step 2: Update .gitignore for the monorepo**

Add to `.gitignore`:

```
# PlatformIO
firmware/.pio

# Next.js
dashboard/.next
dashboard/node_modules
dashboard/dist

# SQLite data
data/

# Superpowers brainstorm
.superpowers/
```

- [ ] **Step 3: Scaffold the Next.js project**

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node
mkdir -p dashboard
cd dashboard
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-import-alias --skip-install
```

Wait — the spec says `src/` directory. Use `--src-dir` instead of `--no-src-dir`. Actually, check what flags create-next-app@latest supports, then configure manually if needed. The key structure is:

```bash
mkdir -p dashboard/src/app/api/telemetry dashboard/src/app/api/settings
mkdir -p dashboard/src/components/animation dashboard/src/components/charts
mkdir -p dashboard/src/lib dashboard/src/config
mkdir -p dashboard/collector
```

- [ ] **Step 4: Install dependencies**

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node/dashboard
npm install next@latest react@latest react-dom@latest typescript @types/react @types/react-dom
npm install tailwindcss @tailwindcss/postcss postcss
npm install recharts mqtt motion lucide-react better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 5: Create next.config.ts**

```typescript
// dashboard/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

`output: "standalone"` is required for Docker deployment. `serverExternalPackages` prevents Next.js from trying to bundle the native `better-sqlite3` module.

- [ ] **Step 6: Verify build works**

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node/dashboard
npm run dev
```

Open `http://localhost:3000` — should show default Next.js page. Kill the dev server.

- [ ] **Step 7: Verify firmware still compiles**

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node/firmware
pio run
```

Expected: `[SUCCESS]`

- [ ] **Step 8: Commit**

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node
git add -A
git commit -m "chore: restructure repo into firmware/ + dashboard/ monorepo"
```

---

## Task 2: Config, types, and threshold definitions

**Files:**
- Create: `dashboard/src/lib/types.ts`
- Create: `dashboard/src/config/sensors.ts`
- Create: `dashboard/src/config/ranges.ts`
- Create: `dashboard/src/lib/thresholds.ts`

- [ ] **Step 1: Define TypeScript types**

```typescript
// dashboard/src/lib/types.ts

export interface Reading {
  timestamp: number; // Unix epoch seconds
  value: number;
}

export interface SensorData {
  scd41: { co2: Reading[]; temp: Reading[]; umi: Reading[] };
  ens160: { eco2: Reading[]; tvoc: Reading[]; airq: Reading[] };
  sht4x: { temp: Reading[]; umi: Reading[] };
  bh1750: { lux: Reading[] };
}

export interface RealtimeValues {
  scd41: { co2: number | null; temp: number | null; umi: number | null };
  ens160: { eco2: number | null; tvoc: number | null; airq: number | null };
  sht4x: { temp: number | null; umi: number | null };
  bh1750: { lux: number | null };
}

export type ThresholdLevel = "success" | "warning" | "danger" | "info";

export interface ThresholdResult {
  level: ThresholdLevel;
  label: string;
}

export interface Settings {
  co2_threshold: number;
  offline_timeout: number;
  pushover_user_key: string;
  pushover_api_token: string;
  alerts_enabled: boolean;
  alert_cooldown: number;
  theme: string;
}

export type RangeId = "1m" | "5m" | "10m" | "15m" | "30m" | "1h" | "6h" | "12h" | "24h" | "3d" | "7d" | "14d" | "30d";

export interface RangeConfig {
  id: RangeId;
  label: string;
  seconds: number;        // total seconds in range
  downsampleSec: number;  // 0 = raw, >0 = avg per N seconds
  realtime: boolean;      // append real-time data points
}
```

- [ ] **Step 2: Define sensor configuration**

```typescript
// dashboard/src/config/sensors.ts

export const MQTT_BROKER_WS = "ws://192.168.100.224:8884/mqtt";
export const MQTT_TOPIC_PREFIX = "teras/iotnode/1/telemetry";

export interface SensorMetric {
  sensor: string;
  measurement: string;
  topic: string;
  label: string;
  unit: string;
  icon: string; // lucide-react icon name
}

export const SENSOR_METRICS: SensorMetric[] = [
  { sensor: "scd41", measurement: "co2", topic: `${MQTT_TOPIC_PREFIX}/scd41/co2`, label: "CO₂", unit: "ppm", icon: "Wind" },
  { sensor: "scd41", measurement: "temp", topic: `${MQTT_TOPIC_PREFIX}/scd41/temp`, label: "Temp (SCD41)", unit: "°C", icon: "Thermometer" },
  { sensor: "scd41", measurement: "umi", topic: `${MQTT_TOPIC_PREFIX}/scd41/umi`, label: "Umidade (SCD41)", unit: "%", icon: "Droplets" },
  { sensor: "ens160", measurement: "eco2", topic: `${MQTT_TOPIC_PREFIX}/ens160/eco2`, label: "eCO₂", unit: "ppm", icon: "Factory" },
  { sensor: "ens160", measurement: "tvoc", topic: `${MQTT_TOPIC_PREFIX}/ens160/tvoc`, label: "TVOC", unit: "ppb", icon: "Factory" },
  { sensor: "ens160", measurement: "airq", topic: `${MQTT_TOPIC_PREFIX}/ens160/airq`, label: "AQI", unit: "", icon: "Wind" },
  { sensor: "sht4x", measurement: "temp", topic: `${MQTT_TOPIC_PREFIX}/sht4x/temp`, label: "Temperatura", unit: "°C", icon: "Thermometer" },
  { sensor: "sht4x", measurement: "umi", topic: `${MQTT_TOPIC_PREFIX}/sht4x/umi`, label: "Umidade", unit: "%", icon: "Droplets" },
  { sensor: "bh1750", measurement: "lux", topic: `${MQTT_TOPIC_PREFIX}/bh1750/lux`, label: "Luminosidade", unit: "lux", icon: "Sun" },
];

// KPI card order (grid 3x2) — which metrics show as KPI cards
export const KPI_METRICS = [
  { sensor: "scd41", measurement: "co2" },
  { sensor: "sht4x", measurement: "temp" },
  { sensor: "sht4x", measurement: "umi" },
  { sensor: "ens160", measurement: "tvoc" },
  { sensor: "ens160", measurement: "airq" },
  { sensor: "bh1750", measurement: "lux" },
];
```

- [ ] **Step 3: Define range configurations**

```typescript
// dashboard/src/config/ranges.ts
import type { RangeConfig, RangeId } from "@/lib/types";

export const RANGES: RangeConfig[] = [
  { id: "1m",  label: "1m",  seconds: 60,         downsampleSec: 0,   realtime: true },
  { id: "5m",  label: "5m",  seconds: 300,        downsampleSec: 0,   realtime: true },
  { id: "10m", label: "10m", seconds: 600,        downsampleSec: 0,   realtime: true },
  { id: "15m", label: "15m", seconds: 900,        downsampleSec: 0,   realtime: true },
  { id: "30m", label: "30m", seconds: 1800,       downsampleSec: 0,   realtime: true },
  { id: "1h",  label: "1h",  seconds: 3600,       downsampleSec: 0,   realtime: true },
  { id: "6h",  label: "6h",  seconds: 21600,      downsampleSec: 0,   realtime: true },
  { id: "12h", label: "12h", seconds: 43200,      downsampleSec: 5,   realtime: false },
  { id: "24h", label: "24h", seconds: 86400,      downsampleSec: 10,  realtime: false },
  { id: "3d",  label: "3d",  seconds: 259200,     downsampleSec: 30,  realtime: false },
  { id: "7d",  label: "7d",  seconds: 604800,     downsampleSec: 60,  realtime: false },
  { id: "14d", label: "14d", seconds: 1209600,    downsampleSec: 120, realtime: false },
  { id: "30d", label: "30d", seconds: 2592000,    downsampleSec: 300, realtime: false },
];

export const DEFAULT_RANGE: RangeId = "1h";

export function getRangeConfig(id: RangeId): RangeConfig {
  return RANGES.find((r) => r.id === id)!;
}
```

- [ ] **Step 4: Define threshold logic**

```typescript
// dashboard/src/lib/thresholds.ts
import type { ThresholdResult } from "./types";

export function getCo2Threshold(value: number): ThresholdResult {
  if (value < 800) return { level: "success", label: "Excelente" };
  if (value <= 1000) return { level: "warning", label: "Moderado" };
  return { level: "danger", label: "Ruim" };
}

export function getTempThreshold(value: number): ThresholdResult {
  if (value >= 18 && value <= 26) return { level: "success", label: "Confortável" };
  if ((value >= 15 && value < 18) || (value > 26 && value <= 30)) return { level: "warning", label: "Atenção" };
  return { level: "danger", label: "Extremo" };
}

export function getHumidityThreshold(value: number): ThresholdResult {
  if (value >= 40 && value <= 60) return { level: "success", label: "Ideal" };
  if ((value >= 30 && value < 40) || (value > 60 && value <= 70)) return { level: "warning", label: "Atenção" };
  return { level: "danger", label: "Extremo" };
}

export function getTvocThreshold(value: number): ThresholdResult {
  if (value < 250) return { level: "success", label: "Bom" };
  if (value <= 2000) return { level: "warning", label: "Moderado" };
  return { level: "danger", label: "Ruim" };
}

export function getAqiThreshold(value: number): ThresholdResult {
  if (value <= 2) return { level: "success", label: "Bom" };
  if (value <= 3) return { level: "warning", label: "Moderado" };
  return { level: "danger", label: "Ruim" };
}

export function getLuxThreshold(_value: number): ThresholdResult {
  return { level: "info", label: "" };
}

export function getThreshold(sensor: string, measurement: string, value: number): ThresholdResult {
  if (sensor === "scd41" && measurement === "co2") return getCo2Threshold(value);
  if (measurement === "temp") return getTempThreshold(value);
  if (measurement === "umi") return getHumidityThreshold(value);
  if (measurement === "tvoc") return getTvocThreshold(value);
  if (measurement === "airq") return getAqiThreshold(value);
  if (measurement === "lux") return getLuxThreshold(value);
  return { level: "info", label: "" };
}

// Map threshold level to CSS variable name
export function thresholdColor(level: ThresholdResult["level"]): string {
  const map = { success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", info: "var(--info)" };
  return map[level];
}
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/types.ts dashboard/src/config/sensors.ts dashboard/src/config/ranges.ts dashboard/src/lib/thresholds.ts
git commit -m "feat: add config, types, and threshold definitions"
```

---

## Task 3: Theme system (14 themes CSS)

**Files:**
- Create: `dashboard/src/config/themes.ts`
- Create: `dashboard/src/app/globals.css`

- [ ] **Step 1: Create theme metadata config**

```typescript
// dashboard/src/config/themes.ts

export interface ThemeDef {
  id: string;
  label: string;
  group: "dark" | "light";
  accent: string; // hex color for swatch preview
}

export const THEMES: ThemeDef[] = [
  // Dark
  { id: "dark",             label: "FitBark Dark",      group: "dark",  accent: "#2eccc0" },
  { id: "monokai",          label: "Monokai",           group: "dark",  accent: "#a6e22e" },
  { id: "dracula",          label: "Dracula",           group: "dark",  accent: "#bd93f9" },
  { id: "nord",             label: "Nord",              group: "dark",  accent: "#88c0d0" },
  { id: "solarized",        label: "Solarized Dark",    group: "dark",  accent: "#b58900" },
  { id: "onedark",          label: "One Dark",          group: "dark",  accent: "#61afef" },
  { id: "github",           label: "GitHub Dark",       group: "dark",  accent: "#58a6ff" },
  { id: "catppuccin",       label: "Catppuccin Mocha",  group: "dark",  accent: "#cba6f7" },
  // Light
  { id: "light",            label: "FitBark Light",     group: "light", accent: "#2eccc0" },
  { id: "solarized-light",  label: "Solarized Light",   group: "light", accent: "#268bd2" },
  { id: "github-light",     label: "GitHub Light",      group: "light", accent: "#0969da" },
  { id: "catppuccin-latte", label: "Catppuccin Latte",  group: "light", accent: "#8839ef" },
  { id: "nord-light",       label: "Nord Light",        group: "light", accent: "#5e81ac" },
  { id: "rosepine-dawn",    label: "Rose Pine Dawn",    group: "light", accent: "#d7827e" },
];

export const DEFAULT_THEME = "dark";
```

- [ ] **Step 2: Create globals.css with all 14 theme definitions**

Port all CSS custom properties from the V5 Debug Terminal `styles.css` at `/Users/rodrigohaguiuda/Documents/FitBark/fb_v5_debug_terminal/styles.css` (lines 9-390).

Read that file and copy all theme blocks. For each theme:
- Keep: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-elevated`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border`, `--border-subtle`, `--accent`, `--accent-hover`, `--accent-strong`, `--accent-dim`, `--accent-border`, `--accent-bg`, `--success`, `--warning`, `--danger`, `--info`, `--purple`, `--cyan`, `--card-shadow`, `--table-hover`, `--pill-bg`, `--pill-active-bg`
- Remove: `--bg-terminal`, `--terminal-line-error-bg`, `--conn-btn-bg`, `--conn-btn-text`
- Add shared tokens at top: `--card-radius: 14px`, `--font-display`, `--font-body`, `--font-mono`

The file should start with `@import "tailwindcss";` then `:root { ... }` for FitBark Dark (default), then `[data-theme="light"] { ... }`, `[data-theme="monokai"] { ... }`, etc.

Also add the `.card` class and utility classes from the FitBark design system:

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
}
```

Add `tabular-nums` utility, body defaults (`font-family: var(--font-body)`), and `h1,h2,h3 { font-family: var(--font-display) }`.

- [ ] **Step 3: Create layout.tsx with font loading and theme provider**

```typescript
// dashboard/src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Air Quality Node",
  description: "Indoor air quality monitoring dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Inline script to apply saved theme before paint — prevents flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('theme');
              if (t && t !== 'dark') document.documentElement.setAttribute('data-theme', t);
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify theme switching works with a minimal page**

Create a temporary `page.tsx` that renders a card and a button to cycle themes. Open in browser, click through themes, verify colors change.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/config/themes.ts dashboard/src/app/globals.css dashboard/src/app/layout.tsx
git commit -m "feat: add 14-theme system with CSS custom properties"
```

---

## Task 4: Collector (MQTT → SQLite + Pushover alerts)

**Files:**
- Create: `dashboard/collector/db.ts`
- Create: `dashboard/collector/alerts.ts`
- Create: `dashboard/collector/index.ts`
- Create: `dashboard/collector/tsconfig.json`

- [ ] **Step 1: Create collector tsconfig**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "../dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["./**/*.ts"]
}
```

- [ ] **Step 2: Install collector-specific dependencies**

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node/dashboard
npm install mqtt better-sqlite3
```

(mqtt and better-sqlite3 should already be installed from Task 1, but ensure they're available.)

- [ ] **Step 3: Create collector database module**

```typescript
// dashboard/collector/db.ts
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "iotnode.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor TEXT NOT NULL,
        measurement TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_readings_lookup ON readings(sensor, measurement, timestamp);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    // Insert default settings if not exist
    const defaults: Record<string, string> = {
      co2_threshold: "1000",
      offline_timeout: "5",
      pushover_user_key: "",
      pushover_api_token: "",
      alerts_enabled: "true",
      alert_cooldown: "15",
      theme: "dark",
    };
    const insert = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
    for (const [k, v] of Object.entries(defaults)) {
      insert.run(k, v);
    }
  }
  return db;
}

export function insertReading(sensor: string, measurement: string, value: number, timestamp: number): void {
  const d = getDb();
  d.prepare("INSERT INTO readings (sensor, measurement, value, timestamp) VALUES (?, ?, ?, ?)").run(sensor, measurement, value, timestamp);
}

export function getSetting(key: string): string | undefined {
  const d = getDb();
  const row = d.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function purgeOldReadings(): void {
  const d = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - 86400 * 90;
  const result = d.prepare("DELETE FROM readings WHERE timestamp < ?").run(cutoff);
  if (result.changes > 0) {
    console.log(`[PURGE] Deleted ${result.changes} readings older than 90 days`);
  }
}
```

- [ ] **Step 4: Create Pushover alert module**

```typescript
// dashboard/collector/alerts.ts
import { getSetting } from "./db";

let lastCo2Alert = 0;
let lastOfflineAlert = 0;
let lastMessageTime = Date.now();

export function updateLastMessageTime(): void {
  lastMessageTime = Date.now();
}

export function getLastMessageTime(): number {
  return lastMessageTime;
}

async function sendPushover(message: string, priority: number): Promise<void> {
  const userKey = getSetting("pushover_user_key");
  const apiToken = getSetting("pushover_api_token");
  if (!userKey || !apiToken) return;

  try {
    const res = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: apiToken,
        user: userKey,
        message,
        title: "Air Quality Node",
        priority,
      }),
    });
    if (!res.ok) {
      console.error(`[PUSHOVER] Failed: ${res.status} ${await res.text()}`);
    } else {
      console.log(`[PUSHOVER] Sent: ${message}`);
    }
  } catch (err) {
    console.error("[PUSHOVER] Error:", err);
  }
}

export async function checkCo2Alert(value: number): Promise<void> {
  const enabled = getSetting("alerts_enabled") === "true";
  if (!enabled) return;

  const threshold = parseInt(getSetting("co2_threshold") || "1000", 10);
  const cooldown = parseInt(getSetting("alert_cooldown") || "15", 10) * 60 * 1000;
  const now = Date.now();

  if (value > threshold && now - lastCo2Alert > cooldown) {
    lastCo2Alert = now;
    await sendPushover(`CO₂ at ${Math.round(value)} ppm (threshold: ${threshold})`, 0);
  }
}

export async function checkOfflineAlert(): Promise<void> {
  const enabled = getSetting("alerts_enabled") === "true";
  if (!enabled) return;

  const timeout = parseInt(getSetting("offline_timeout") || "5", 10) * 60 * 1000;
  const now = Date.now();
  const elapsed = now - lastMessageTime;

  if (elapsed > timeout && now - lastOfflineAlert > 30 * 60 * 1000) {
    lastOfflineAlert = now;
    const minutes = Math.round(elapsed / 60000);
    await sendPushover(`Air Quality Node offline for ${minutes} minutes`, 1);
  }
}
```

- [ ] **Step 5: Create main collector entry point**

```typescript
// dashboard/collector/index.ts
import mqtt from "mqtt";
import { insertReading, purgeOldReadings } from "./db";
import { checkCo2Alert, checkOfflineAlert, updateLastMessageTime } from "./alerts";

const MQTT_URL = process.env.MQTT_URL || "mqtt://192.168.100.224:1883";
const TOPIC = "teras/iotnode/1/telemetry/#";

console.log("[COLLECTOR] Starting...");
console.log(`[COLLECTOR] Connecting to ${MQTT_URL}`);

const client = mqtt.connect(MQTT_URL);

client.on("connect", () => {
  console.log("[COLLECTOR] Connected to MQTT broker");
  client.subscribe(TOPIC, (err) => {
    if (err) console.error("[COLLECTOR] Subscribe error:", err);
    else console.log(`[COLLECTOR] Subscribed to ${TOPIC}`);
  });
});

client.on("message", async (topic, payload) => {
  // topic format: teras/iotnode/1/telemetry/<sensor>/<measurement>
  const parts = topic.split("/");
  if (parts.length !== 5) return;

  const sensor = parts[3];
  const measurement = parts[4];
  const value = parseFloat(payload.toString());
  if (isNaN(value)) return;

  const timestamp = Math.floor(Date.now() / 1000);

  insertReading(sensor, measurement, value, timestamp);
  updateLastMessageTime();

  // Check CO2 alert (only for real CO2 from SCD41)
  if (sensor === "scd41" && measurement === "co2") {
    await checkCo2Alert(value);
  }
});

client.on("error", (err) => {
  console.error("[COLLECTOR] MQTT error:", err);
});

client.on("reconnect", () => {
  console.log("[COLLECTOR] Reconnecting...");
});

// Check for offline alert every 60 seconds
setInterval(() => {
  checkOfflineAlert();
}, 60000);

// Purge old readings once per day
setInterval(() => {
  purgeOldReadings();
}, 86400000);

// Initial purge on startup
purgeOldReadings();

console.log("[COLLECTOR] Running. Waiting for MQTT messages...");
```

- [ ] **Step 6: Add build script to package.json**

Add to `dashboard/package.json` scripts:

```json
"build:collector": "tsc -p collector/tsconfig.json"
```

- [ ] **Step 7: Build and test the collector locally**

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node/dashboard
mkdir -p data
npm run build:collector
node dist/index.js
```

Expected: Connects to MQTT, starts receiving messages, inserts into `data/iotnode.db`. Verify with:

```bash
sqlite3 data/iotnode.db "SELECT * FROM readings ORDER BY id DESC LIMIT 5;"
```

Kill with Ctrl+C after verifying.

- [ ] **Step 8: Commit**

```bash
git add dashboard/collector/ dashboard/data/.gitkeep
git commit -m "feat: add MQTT collector with SQLite persistence and Pushover alerts"
```

---

## Task 5: API Routes (telemetry + settings)

**Files:**
- Create: `dashboard/src/lib/db.ts`
- Create: `dashboard/src/app/api/telemetry/route.ts`
- Create: `dashboard/src/app/api/settings/route.ts`

- [ ] **Step 1: Create server-side database helper**

```typescript
// dashboard/src/lib/db.ts
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "iotnode.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma("journal_mode = WAL");
  }
  return db;
}

interface ReadingRow {
  timestamp: number;
  value: number;
}

export function queryReadings(
  sensor: string,
  measurement: string,
  fromTimestamp: number,
  downsampleSec: number
): ReadingRow[] {
  const d = getDb();

  if (downsampleSec === 0) {
    // Raw data
    return d
      .prepare("SELECT timestamp, value FROM readings WHERE sensor = ? AND measurement = ? AND timestamp >= ? ORDER BY timestamp ASC")
      .all(sensor, measurement, fromTimestamp) as ReadingRow[];
  }

  // Downsampled: average per bucket
  return d
    .prepare(`
      SELECT (timestamp / ? * ?) AS timestamp, AVG(value) AS value
      FROM readings
      WHERE sensor = ? AND measurement = ? AND timestamp >= ?
      GROUP BY timestamp / ?
      ORDER BY timestamp ASC
    `)
    .all(downsampleSec, downsampleSec, sensor, measurement, fromTimestamp, downsampleSec) as ReadingRow[];
}

export function getAllSettings(): Record<string, string> {
  const d = getDb();
  const rows = d.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export function updateSettings(updates: Record<string, string>): void {
  // Need a writable connection for this
  const writableDb = new Database(DB_PATH);
  writableDb.pragma("journal_mode = WAL");
  const stmt = writableDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(updates)) {
    stmt.run(k, v);
  }
  writableDb.close();
}
```

- [ ] **Step 2: Create telemetry API route**

```typescript
// dashboard/src/app/api/telemetry/route.ts
import { NextRequest, NextResponse } from "next/server";
import { queryReadings } from "@/lib/db";
import { RANGES } from "@/config/ranges";
import type { RangeId } from "@/lib/types";

const SENSOR_MEASUREMENTS: Record<string, string[]> = {
  scd41: ["co2", "temp", "umi"],
  ens160: ["eco2", "tvoc", "airq"],
  sht4x: ["temp", "umi"],
  bh1750: ["lux"],
};

export async function GET(request: NextRequest) {
  const rangeId = (request.nextUrl.searchParams.get("range") || "1h") as RangeId;
  const rangeConfig = RANGES.find((r) => r.id === rangeId);

  if (!rangeConfig) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const fromTimestamp = Math.floor(Date.now() / 1000) - rangeConfig.seconds;
  const result: Record<string, Record<string, { timestamp: number; value: number }[]>> = {};

  for (const [sensor, measurements] of Object.entries(SENSOR_MEASUREMENTS)) {
    result[sensor] = {};
    for (const measurement of measurements) {
      result[sensor][measurement] = queryReadings(sensor, measurement, fromTimestamp, rangeConfig.downsampleSec);
    }
  }

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Create settings API route**

```typescript
// dashboard/src/app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, updateSettings } from "@/lib/db";

export async function GET() {
  const settings = getAllSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    updates[k] = String(v);
  }

  updateSettings(updates);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Test API routes**

Start the collector first (so there's data in SQLite), then start the Next.js dev server:

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node/dashboard
node dist/index.js &
npm run dev &
```

Test:

```bash
curl http://localhost:3000/api/telemetry?range=5m | python3 -m json.tool | head -20
curl http://localhost:3000/api/settings | python3 -m json.tool
```

Both should return valid JSON. Kill both processes after testing.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/db.ts dashboard/src/app/api/
git commit -m "feat: add telemetry and settings API routes"
```

---

## Task 6: Animation components

**Files:**
- Create: `dashboard/src/components/animation/AnimateIn.tsx`
- Create: `dashboard/src/components/animation/StaggerChildren.tsx`
- Create: `dashboard/src/components/animation/CountUp.tsx`

- [ ] **Step 1: Create AnimateIn component**

Port the AnimateIn component from the FitBark Developer Dashboard. Reference: `/Users/rodrigohaguiuda/Documents/FitBark/fitbark_developer_dashboard/frontend/components/animation/AnimateIn.tsx`

Read the file, adapt to the dashboard project. It wraps children in a `motion.div` with configurable animation type (fadeSlideUp default, 0.45s duration).

- [ ] **Step 2: Create StaggerChildren component**

Port StaggerChildren from FitBark. Reference: `/Users/rodrigohaguiuda/Documents/FitBark/fitbark_developer_dashboard/frontend/components/animation/StaggerChildren.tsx`

Default stagger: 0.04s for KPI grids.

- [ ] **Step 3: Create CountUp component**

Port CountUp from FitBark. Reference: `/Users/rodrigohaguiuda/Documents/FitBark/fitbark_developer_dashboard/frontend/components/animation/CountUp.tsx`

Uses `animate` from `motion` to animate from 0 (or previous value) to target value over 0.5s. Supports `prefix`, `suffix`, `decimals`.

- [ ] **Step 4: Verify animations render**

Create a temporary test in `page.tsx` that uses all three components. Verify in browser.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/animation/
git commit -m "feat: add AnimateIn, StaggerChildren, CountUp animation components"
```

---

## Task 7: MQTT real-time hook

**Files:**
- Create: `dashboard/src/lib/mqtt.ts`

- [ ] **Step 1: Create useMqtt hook**

```typescript
// dashboard/src/lib/mqtt.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mqtt, { MqttClient } from "mqtt";
import { MQTT_BROKER_WS, MQTT_TOPIC_PREFIX } from "@/config/sensors";
import type { RealtimeValues } from "./types";

const INITIAL_VALUES: RealtimeValues = {
  scd41: { co2: null, temp: null, umi: null },
  ens160: { eco2: null, tvoc: null, airq: null },
  sht4x: { temp: null, umi: null },
  bh1750: { lux: null },
};

export function useMqtt() {
  const [values, setValues] = useState<RealtimeValues>(INITIAL_VALUES);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<number>(0);
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    const client = mqtt.connect(MQTT_BROKER_WS, {
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    });
    clientRef.current = client;

    client.on("connect", () => {
      setConnected(true);
      client.subscribe(`${MQTT_TOPIC_PREFIX}/#`);
    });

    client.on("close", () => setConnected(false));
    client.on("offline", () => setConnected(false));

    client.on("message", (topic, payload) => {
      // topic: teras/iotnode/1/telemetry/<sensor>/<measurement>
      const parts = topic.split("/");
      if (parts.length !== 5) return;

      const sensor = parts[3] as keyof RealtimeValues;
      const measurement = parts[4];
      const value = parseFloat(payload.toString());
      if (isNaN(value)) return;

      setLastMessage(Date.now());
      setValues((prev) => {
        const sensorData = prev[sensor];
        if (!sensorData || !(measurement in sensorData)) return prev;
        return {
          ...prev,
          [sensor]: { ...sensorData, [measurement]: value },
        };
      });
    });

    return () => {
      client.end();
    };
  }, []);

  return { values, connected, lastMessage };
}
```

- [ ] **Step 2: Test the hook**

Add a temporary component to `page.tsx` that uses `useMqtt()` and displays raw values. Verify values update in real-time from the IoT node.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/mqtt.ts
git commit -m "feat: add useMqtt real-time hook for EMQX WebSocket"
```

---

## Task 8: StatusBadge and KpiCard components

**Files:**
- Create: `dashboard/src/components/StatusBadge.tsx`
- Create: `dashboard/src/components/KpiCard.tsx`
- Create: `dashboard/src/components/KpiGrid.tsx`

- [ ] **Step 1: Create StatusBadge**

Pill badge component following FitBark pattern. Props: `level` (success/warning/danger/info), `label` (string). Uses the formula: `bg rgba(C, 0.1)` + `border rgba(C, 0.25)` + solid text color.

Use `frontend-design` skill for implementation quality.

- [ ] **Step 2: Create KpiCard**

Props: `icon` (lucide icon component), `value` (number | null), `label` (string), `unit` (string), `sensor` (string), `measurement` (string).

Layout: icon container left (gradient bg) + value/label right + StatusBadge.

Value rendered via CountUp component. Color driven by `getThreshold()`.

Icon container: `w-11 h-11 rounded-xl` with `linear-gradient(135deg, {color}22, {color}0a)`.

Use `frontend-design` skill for polish.

- [ ] **Step 3: Create KpiGrid**

Wraps 6 KpiCard instances in a `grid grid-cols-3 gap-3` with StaggerChildren animation.

Maps `KPI_METRICS` from `config/sensors.ts` to KpiCard components, receiving real-time values as props.

- [ ] **Step 4: Test KPI grid with live data**

Wire up in `page.tsx` with `useMqtt()`. Verify 6 cards animate in, values update live, colors change by threshold.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/StatusBadge.tsx dashboard/src/components/KpiCard.tsx dashboard/src/components/KpiGrid.tsx
git commit -m "feat: add KpiCard and KpiGrid with threshold badges"
```

---

## Task 9: Chart shared components and CO₂ chart

**Files:**
- Create: `dashboard/src/components/charts/ChartTooltip.tsx`
- Create: `dashboard/src/components/charts/Co2Chart.tsx`

- [ ] **Step 1: Create shared chart tooltip**

Custom Recharts tooltip component matching FitBark style:

```typescript
// Style object used by all charts
export const CHART_TOOLTIP_STYLE = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--text-primary)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};
```

Plus a `ChartTooltip` component that formats timestamp as 24h and shows sensor values.

- [ ] **Step 2: Create Co2Chart**

Full-width Recharts `ComposedChart` with:
- `Area` for SCD41 CO₂ (solid, accent color, gradient fill)
- `Line` for ENS160 eCO₂ (dashed, warning color, no fill)
- `ReferenceLine` at CO₂ threshold (dashed, danger, 50% opacity)
- Legend: "SCD41 (real)" + "ENS160 (estimado)"
- X axis: timestamps formatted as HH:mm
- Y axis: ppm
- Grid, tooltip per FitBark spec
- Wrapped in AnimateIn with `key={rangeId}` for re-trigger on range change

Props: `data` (combined SCD41 + ENS160 readings), `threshold` (number).

Use `frontend-design` skill for visual quality.

- [ ] **Step 3: Test with historical data**

Wire up in `page.tsx`: fetch from `/api/telemetry?range=1h`, pass to Co2Chart. Verify chart renders with both lines and threshold reference line.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/charts/ChartTooltip.tsx dashboard/src/components/charts/Co2Chart.tsx
git commit -m "feat: add CO2 chart with SCD41 vs ENS160 comparison"
```

---

## Task 10: Temperature & Humidity chart

**Files:**
- Create: `dashboard/src/components/charts/TempHumChart.tsx`

- [ ] **Step 1: Create TempHumChart**

Recharts `ComposedChart` with dual Y axis:
- Left Y axis: Temperature (°C)
- Right Y axis: Humidity (%)
- `Line` SHT4x temp (solid, success green, strokeWidth 2)
- `Line` SCD41 temp (dashed, info blue, strokeWidth 1.5)
- `Line` SHT4x humidity (solid, `#a78bfa` purple, strokeWidth 2)
- `Line` SCD41 humidity (dashed, `#f472b6` pink, strokeWidth 1.5)
- Legend with all 4 series
- Same tooltip, grid, axis styling as Co2Chart

Use `frontend-design` skill.

- [ ] **Step 2: Test and commit**

```bash
git add dashboard/src/components/charts/TempHumChart.tsx
git commit -m "feat: add temperature and humidity dual-axis chart"
```

---

## Task 11: TVOC chart and Lux chart

**Files:**
- Create: `dashboard/src/components/charts/TvocChart.tsx`
- Create: `dashboard/src/components/charts/LuxChart.tsx`

- [ ] **Step 1: Create TvocChart**

Recharts `ComposedChart` with:
- `Area` for TVOC (warning color, gradient fill)
- `Line` for AQI (step type, colored by level or as secondary line)
- Dual Y axis: TVOC ppb (left), AQI 1-5 (right)

- [ ] **Step 2: Create LuxChart**

Simple Recharts `AreaChart`:
- `Area` for Lux (info blue, gradient fill)
- Single Y axis (lux)

Use `frontend-design` skill for both.

- [ ] **Step 3: Test all 4 charts together and commit**

```bash
git add dashboard/src/components/charts/TvocChart.tsx dashboard/src/components/charts/LuxChart.tsx
git commit -m "feat: add TVOC and luminosity charts"
```

---

## Task 12: Header with RangeSelector and ThemePicker

**Files:**
- Create: `dashboard/src/components/RangeSelector.tsx`
- Create: `dashboard/src/components/ThemePicker.tsx`
- Create: `dashboard/src/components/Header.tsx`

- [ ] **Step 1: Create RangeSelector**

Scrollable horizontal pill selector with 13 options. Active pill uses accent styling (`--pill-active-bg`, `--accent` text). Uses `RANGES` from config.

Props: `value` (RangeId), `onChange` (callback).

- [ ] **Step 2: Create ThemePicker**

Dropdown button. When open, shows grouped list (Dark separator Light). Each option: small color circle (accent swatch) + theme name. Click applies theme via `document.documentElement.setAttribute('data-theme', id)` and saves to `localStorage`.

Uses `THEMES` from config. Dropdown positioned below button, closes on outside click.

- [ ] **Step 3: Create Header**

Composition: title "Air Quality Node" + online/offline StatusBadge (driven by `connected` from useMqtt) + RangeSelector + ThemePicker.

Layout: flex row, space-between, items-center. Responsive — on mobile, range selector wraps below.

Use `frontend-design` skill.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/RangeSelector.tsx dashboard/src/components/ThemePicker.tsx dashboard/src/components/Header.tsx
git commit -m "feat: add header with range selector and theme picker"
```

---

## Task 13: Settings section

**Files:**
- Create: `dashboard/src/components/Settings.tsx`

- [ ] **Step 1: Create Settings component**

Collapsible section at bottom of page. Chevron toggle to expand/collapse (default collapsed).

Contents:
- CO₂ threshold input (number, default 1000)
- Offline timeout input (number, minutes, default 5)
- Alert cooldown input (number, minutes, default 15)
- Pushover User Key input (text/password)
- Pushover API Token input (text/password)
- Alerts enabled toggle (switch)
- Save button

On mount: `GET /api/settings` to load current values.
On save: `PUT /api/settings` with changed values.

Input styling: FitBark pattern — `bg-[var(--bg-tertiary)]`, `border border-[var(--border)]`, `rounded-lg`, focus glow with accent.

Use `frontend-design` skill.

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/Settings.tsx
git commit -m "feat: add collapsible settings section with Pushover config"
```

---

## Task 14: Main page assembly and real-time integration

**Files:**
- Create: `dashboard/src/app/page.tsx`

- [ ] **Step 1: Assemble the full page**

This is the main integration task. `page.tsx` is a client component that:

1. Calls `useMqtt()` for real-time values and connection status
2. Manages `rangeId` state (default "1h")
3. Fetches historical data from `/api/telemetry?range={rangeId}` (via `useEffect` + `fetch`, re-fetch on range change)
4. For ranges with `realtime: true`: merges new MQTT data points into the chart data array
5. Renders in order: Header → KpiGrid → Co2Chart → TempHumChart → TvocChart → LuxChart → Settings
6. Wraps chart section in AnimateIn with `key={rangeId}`

Data flow:
- KPI cards receive values from `useMqtt().values`
- Charts receive merged historical + real-time data
- Header receives `connected` status and range state

- [ ] **Step 2: Test the complete dashboard**

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node/dashboard
npm run dev
```

Open `http://localhost:3000`. Verify:
- KPI cards show live values, colors match thresholds
- All 4 charts render with historical data
- Range selector changes chart data
- Theme picker cycles through all 14 themes
- Settings section loads/saves
- Online/offline badge reflects MQTT connection

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/page.tsx
git commit -m "feat: assemble complete dashboard with real-time integration"
```

---

## Task 15: Docker deployment

**Files:**
- Create: `dashboard/Dockerfile`
- Create: `dashboard/docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

Multi-stage Alpine build:

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm run build:collector

# Stage 3: Runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# better-sqlite3 needs these at runtime
RUN apk add --no-cache libstdc++

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
services:
  web:
    build: .
    command: node server.js
    ports:
      - "3100:3000"
    volumes:
      - ../data:/app/data
    environment:
      - DB_PATH=/app/data/iotnode.db
    restart: unless-stopped

  collector:
    build: .
    command: node dist/index.js
    volumes:
      - ../data:/app/data
    environment:
      - DB_PATH=/app/data/iotnode.db
      - MQTT_URL=mqtt://192.168.100.224:1883
    restart: unless-stopped
```

- [ ] **Step 3: Test Docker build locally**

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node/dashboard
docker compose build
docker compose up -d
```

Verify `http://localhost:3100` shows the dashboard. Check `docker compose logs collector` shows MQTT messages being received.

```bash
docker compose down
```

- [ ] **Step 4: Deploy to Bee-Docker**

```bash
cd /Users/rodrigohaguiuda/Documents/PlatformIO/Projects/IoT-Node
# Copy project to Bee-Docker
scp -r dashboard Bee-Docker:/home/rhaguiuda/iotnode-dashboard/
ssh Bee-Docker "cd /home/rhaguiuda/iotnode-dashboard/dashboard && docker compose up -d --build"
```

Verify `http://192.168.100.224:3100` shows the dashboard.

- [ ] **Step 5: Commit**

```bash
git add dashboard/Dockerfile dashboard/docker-compose.yml
git commit -m "feat: add Docker deployment configuration"
```

---

## Task 16: Final polish and README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README.md**

Update the root README to document both firmware and dashboard. Add a "Dashboard" section explaining how to run locally (`npm run dev`) and deploy (`docker compose up`).

- [ ] **Step 2: Add .superpowers to .gitignore if not already**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: update README with dashboard documentation"
```
