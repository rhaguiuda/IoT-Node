# Air Quality Dashboard — Design Spec

## Overview

Single page web dashboard for indoor air quality monitoring. Displays real-time sensor data from an ESP32-S2 IoT node via MQTT WebSocket, with historical data stored in SQLite. Follows the FitBark design system with 14 selectable themes.

**Project location:** `IoT-Node/dashboard/`

> **Note (2026-04-15):** The original design mentioned additional sensors (SHT4x, ENS160, BH1750) providing TVOC, AQI, eCO₂ and Lux. These were removed from the hardware because they were unreliable in testing. The only sensor currently in the node is the **Sensirion SCD41**, which reports **CO₂, temperature and humidity**. This spec reflects the simplified, shipped version.

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Animations | motion (AnimateIn, StaggerChildren, CountUp) |
| Real-time | mqtt.js (MQTT over WebSocket) |
| Database | better-sqlite3 (read in API Routes) |
| Icons | lucide-react |
| Collector | Node.js script (MQTT subscriber → SQLite writer) |
| Deploy | Docker Compose on Bee-Docker (192.168.100.224) |

## Architecture

```
                    EMQX (192.168.100.224)
                    ├── :1883 (MQTT)
                    └── :8884 (WebSocket)
                         │
          ┌──────────────┼──────────────┐
          ▼                             ▼
     Collector                      Browser
     (container)                   (mqtt.js)
          │                             │
          ▼                             ▼
       SQLite                    React State
     (histórico)               (valores atuais)
          │                             │
          ▼                             │
    API Routes ─────────────────────────┘
    (GET /api/telemetry?range=24h)
```

### Two independent data paths

1. **Real-time (browser → EMQX via WebSocket):** Hook `useMqtt()` connects to `ws://192.168.100.224:8884/mqtt`, subscribes to `teras/iotnode/1/telemetry/#`. Each message updates React state. KPI card values animate smoothly via CountUp (interpolates from old value to new). If no message is received in 60 seconds, status badge changes to "Offline" (danger). Auto-reconnect with exponential backoff.

2. **Historical (API Routes → SQLite):** API Route reads SQLite with downsampling appropriate to the selected range. When range is 6h, the chart loads historical data and appends new real-time data points as they arrive (live-growing line). Ranges 7d and 30d are historical only.

## Page Layout

```
┌─────────────────────────────────────────────────┐
│  Header                                          │
│  "Air Quality Node" + online/offline badge       │
│  Range presets: [6h] [24h] [7d] [30d]           │
│  Theme picker dropdown (grouped dark/light)      │
├─────────────────────────────────────────────────┤
│  KPI Cards — grid 3×1                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ CO₂      │ │ Temp     │ │ Umidade  │        │
│  │ SCD41    │ │ SCD41    │ │ SCD41    │        │
│  └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────┤
│  Chart 1: CO₂ (full width)                      │
│  SCD41 CO₂ area chart                            │
│  Reference line at threshold (danger zone)       │
├─────────────────────────────────────────────────┤
│  Chart 2: Temperatura (full width)               │
│  SCD41 temperature area chart                    │
├─────────────────────────────────────────────────┤
│  Chart 3: Umidade (full width)                   │
│  SCD41 humidity area chart                       │
├─────────────────────────────────────────────────┤
│  Settings (collapsible section)                  │
│  CO₂ threshold, offline timeout, Pushover keys   │
│  Alert enable/disable toggle                     │
└─────────────────────────────────────────────────┘
```

## KPI Cards

Each card follows the FitBark KpiCard pattern:

- Icon container: `w-11 h-11 rounded-xl` with `linear-gradient(135deg, {color}22, {color}0a)`
- Value: `text-[22px] font-bold tracking-tight` using Bricolage Grotesque — color changes by threshold
- Label: `text-[11px] font-medium text-text-tertiary uppercase tracking-wider`
- Status badge: `rounded-full border` with formula `bg rgba(C, 0.1)` + `border rgba(C, 0.25)` + solid text
- Entry animation: StaggerChildren (0.04s stagger) + CountUp (0.5s)
- Real-time updates: CountUp interpolates smoothly from previous to new value

### Threshold colors

| Metric | Green (success) | Yellow (warning) | Red (danger) |
|---|---|---|---|
| CO₂ (ppm) | < 800 | 800–1000 | > 1000 |
| Temperature (°C) | 18–26 | 15–18 or 26–30 | < 15 or > 30 |
| Humidity (%) | 40–60 | 30–40 or 60–70 | < 30 or > 70 |

## Charts (Recharts)

All charts follow FitBark Console chart standards:

- **Tooltip:** `bg: var(--bg-elevated)`, `border: 1px solid var(--border)`, `borderRadius: 10`, `fontSize: 12`, `color: var(--text-primary)`, `boxShadow: 0 4px 12px rgba(0,0,0,0.1)`
- **Grid:** `strokeDasharray="3 3"`, `stroke="var(--border)"`, `strokeOpacity={0.6}`, no vertical lines
- **Axis ticks:** `fontSize: 11`, `fill: "var(--text-tertiary)"`, no axisLine/tickLine
- **Area fill:** linearGradient from accent 30% opacity to accent 2% opacity
- **Active dot:** `r: 4`, fill accent, stroke bg-secondary, strokeWidth 2
- **Reference lines:** dashed, danger color, 50% opacity (for thresholds)
- **Time format:** 24-hour (`hour12: false`)
- **Entry animation:** AnimateIn fade on data load, re-trigger on range change via `key={range}`

### Chart 1: CO₂

- SCD41 CO₂: solid line, `var(--accent)`, strokeWidth 2, area fill with gradient
- Reference line at CO₂ threshold (configurable, default 1000 ppm): dashed, `var(--danger)`, 50% opacity

### Chart 2: Temperature

- SCD41 temperature: solid line, `var(--warning)`, strokeWidth 2, area fill with gradient
- Single Y axis (°C)

### Chart 3: Humidity

- SCD41 humidity: solid line, `var(--info)`, strokeWidth 2, area fill with gradient
- Single Y axis (%)

### Chart interactions (applies to all three charts)

All three charts share interactive controls implemented directly in the `SimpleChart` component:

- **Scroll zoom on X axis.** Mouse wheel zooms in (scroll up) or out (scroll down) on the time axis, anchored at the cursor position so the timestamp under the mouse remains fixed during the zoom. Factor 0.8× per scroll-in tick, 1.25× per scroll-out tick. Clamped to a minimum visible span of 5 seconds.
- **Absolute-timestamp domain.** Zoom state is stored as `[startTs, endTs]` in absolute Unix seconds, so incoming real-time data does not disturb the framing. The Y axis auto-fits because data is filtered to the visible window before Recharts renders it.
- **Reset-zoom button.** Rendered in the card header (top-right, next to the unit label) only when zoom is active. Styled with `--bg-elevated` / `--border` / `--text-secondary` so it follows the active theme. Clears zoom on click.
- **Auto reset on range change.** When the user selects a different range preset (e.g. 6h → 24h), the zoom state clears. When zoomed fully out by scroll, the zoom state also clears so the chart returns to a sliding-window view.
- **Page-scroll suppression.** Wheel events on the chart are registered with `{ passive: false }` via a direct `addEventListener` (React's `onWheel` cannot reliably `preventDefault` in modern browsers) so scrolling over a chart does not scroll the page.
- **Min / Avg / Max line.** Shown as an 11 px subtitle under the chart title, in `--text-tertiary` (labels) + `--text-secondary` (values), tabular-nums. Computed from the currently visible points (respects zoom), using the same decimal formatting as the chart's Y axis. Hidden when there is no data.

## Range Presets

Dropdown or scrollable pill selector in header with 13 granularity options. Downsampling is minimal — prefer maximum data points, only downsample when raw data would cause noticeable UI lag.

| Range | Downsampling | Real-time append | ~Data points |
|---|---|---|---|
| 1m | raw (1s) | Yes | ~60 |
| 5m | raw (1s) | Yes | ~300 |
| 10m | raw (1s) | Yes | ~600 |
| 15m | raw (1s) | Yes | ~900 |
| 30m | raw (1s) | Yes | ~1,800 |
| 1h | raw (1s) | Yes | ~3,600 |
| 6h | raw (1s) | Yes | ~21,600 |
| 12h | avg per 5s | No | ~8,640 |
| 24h | avg per 10s | No | ~8,640 |
| 3d | avg per 30s | No | ~8,640 |
| 7d | avg per 1 min | No | ~10,080 |
| 14d | avg per 2 min | No | ~10,080 |
| 30d | avg per 5 min | No | ~8,640 |

Ranges up to 6h use raw data (no downsampling at all). Longer ranges apply minimal averaging to keep data points under ~10k per chart per sensor, which Recharts handles well with SVG rendering.

If performance testing reveals that a specific range is sluggish, the downsampling interval for that range can be increased — but start with maximum fidelity and only reduce if needed.

## Theme System

14 themes ported from FitBark V5 Debug Terminal. All colors via CSS custom properties. Applied via `data-theme` attribute on `<html>`. Persisted in `localStorage`.

### Dark themes (8)

| Theme | ID | Accent |
|---|---|---|
| FitBark Dark (default) | `dark` | `#2eccc0` teal |
| Monokai | `monokai` | `#a6e22e` green |
| Dracula | `dracula` | `#bd93f9` purple |
| Nord | `nord` | `#88c0d0` frost |
| Solarized Dark | `solarized` | `#b58900` yellow |
| One Dark | `onedark` | `#61afef` blue |
| GitHub Dark | `github` | `#58a6ff` blue |
| Catppuccin Mocha | `catppuccin` | `#cba6f7` lavender |

### Light themes (6)

| Theme | ID | Accent |
|---|---|---|
| FitBark Light | `light` | `#2eccc0` teal |
| Solarized Light | `solarized-light` | `#268bd2` blue |
| GitHub Light | `github-light` | `#0969da` blue |
| Catppuccin Latte | `catppuccin-latte` | `#8839ef` purple |
| Nord Light | `nord-light` | `#5e81ac` blue |
| Rose Pine Dawn | `rosepine-dawn` | `#d7827e` rose |

### Theme picker

Dropdown in header, grouped with separator between dark and light sections. Each option shows a small color swatch (accent color circle) + theme name.

### CSS tokens per theme

Ported from V5 Debug Terminal `styles.css`. Each theme defines:

```
--bg-primary, --bg-secondary, --bg-tertiary, --bg-elevated
--text-primary, --text-secondary, --text-tertiary
--border, --border-subtle
--accent, --accent-hover, --accent-strong, --accent-dim, --accent-border, --accent-bg
--success, --warning, --danger, --info, --purple, --cyan
--card-shadow, --table-hover, --pill-bg, --pill-active-bg
```

Tokens not needed from Debug Terminal: `--bg-terminal`, `--terminal-line-error-bg`, `--conn-btn-*`.

Charts, KPI cards, badges, and all UI elements reference these tokens — theme changes propagate automatically.

## Alerts (Pushover)

Handled by the collector process. Two alert types:

### CO₂ high

- Triggers when SCD41 CO₂ > threshold (default 1000 ppm)
- Cooldown: 15 minutes between repeated alerts (configurable)
- Pushover priority: 0 (normal)
- Message: "CO₂ at {value} ppm (threshold: {threshold})"

### Sensor offline

- Triggers when no MQTT message received for X minutes (default 5)
- Cooldown: 30 minutes
- Pushover priority: 1 (high)
- Message: "Air Quality Node offline for {minutes} minutes"

### Configuration

Stored in SQLite `settings` table. Editable via the Settings section in the dashboard (PUT /api/settings). Collector reads settings on each check (no restart needed).

## SQLite Schema

```sql
CREATE TABLE readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor TEXT NOT NULL,
    measurement TEXT NOT NULL,
    value REAL NOT NULL,
    timestamp INTEGER NOT NULL
);
CREATE INDEX idx_readings_lookup ON readings(sensor, measurement, timestamp);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

Only rows with `sensor = 'scd41'` and `measurement IN ('co2', 'temp', 'umi')` are written. The `sensor` column is retained for schema flexibility but currently has a single value.

### Default settings

| Key | Default | Description |
|---|---|---|
| `co2_threshold` | `1000` | CO₂ alert threshold (ppm) |
| `offline_timeout` | `5` | Minutes without data before offline alert |
| `pushover_user_key` | `""` | Pushover user key |
| `pushover_api_token` | `""` | Pushover app API token |
| `alerts_enabled` | `true` | Global alert toggle |
| `alert_cooldown` | `15` | Minutes between repeated CO₂ alerts |
| `theme` | `dark` | Active theme ID |

### Retention

Collector deletes records older than 90 days once per day (`DELETE FROM readings WHERE timestamp < strftime('%s','now') - 86400*90`).

### WAL mode

SQLite opened with `PRAGMA journal_mode=WAL` for concurrent read (API Routes) + write (collector).

## API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/telemetry?range=6h` | GET | Readings downsampled per range |
| `/api/telemetry?range=24h` | GET | Grouped by 10 s |
| `/api/telemetry?range=7d` | GET | Grouped by 1 min |
| `/api/telemetry?range=30d` | GET | Grouped by 5 min |
| `/api/settings` | GET | All settings as JSON object |
| `/api/settings` | PUT | Update settings (partial, merge) |
| `/api/trend` | GET | Last-2min vs previous-2min averages per metric |

### Telemetry response format

```json
{
  "co2":  [{ "timestamp": 1712700000, "value": 1231.5 }, ...],
  "temp": [{ "timestamp": 1712700000, "value": 24.3   }, ...],
  "umi":  [{ "timestamp": 1712700000, "value": 52.1   }, ...]
}
```

## File Structure

```
IoT-Node/
├── firmware/                     ← PlatformIO (existing)
│   ├── src/main.cpp
│   ├── platformio.ini
│   └── ...
├── dashboard/                    ← Next.js app + collector
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx        ← fonts, providers, theme
│   │   │   ├── globals.css       ← 14 themes CSS tokens
│   │   │   ├── page.tsx          ← single page dashboard (3 SimpleChart instances)
│   │   │   └── api/
│   │   │       ├── telemetry/route.ts  ← GET readings with downsampling
│   │   │       ├── settings/route.ts   ← GET/PUT settings
│   │   │       └── trend/route.ts      ← GET per-metric trend
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── KpiCard.tsx
│   │   │   ├── KpiGrid.tsx
│   │   │   ├── ThemePicker.tsx
│   │   │   ├── RangeSelector.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── animation/
│   │   │   │   ├── AnimateIn.tsx
│   │   │   │   ├── StaggerChildren.tsx
│   │   │   │   └── CountUp.tsx
│   │   │   └── charts/
│   │   │       └── ChartTooltip.tsx   ← shared chart style tokens & formatters
│   │   ├── lib/
│   │   │   ├── mqtt.ts           ← useMqtt() hook
│   │   │   ├── db.ts             ← better-sqlite3 queries
│   │   │   ├── thresholds.ts     ← ranges and colors per metric
│   │   │   └── types.ts
│   │   └── config/
│   │       ├── sensors.ts        ← sensor definitions, topics, units
│   │       ├── ranges.ts         ← range preset config
│   │       └── themes.ts         ← theme metadata (id, label, group)
│   ├── collector/                ← MQTT → SQLite + Pushover alerts
│   ├── package.json
│   ├── Dockerfile                ← multi-stage Alpine build
│   ├── docker-compose.yml
│   └── tsconfig.json
├── docs/
│   └── superpowers/specs/        ← this spec
└── README.md
```

The three charts are rendered by a single `SimpleChart` component used three times (for `co2`, `temp`, `umi`) directly in `page.tsx`, rather than separate `Co2Chart`/`TempChart`/`HumidityChart` components.

## Docker Deployment

```yaml
services:
  web:
    build: ./dashboard
    command: node .next/standalone/server.js
    ports: ["3100:3000"]
    volumes: ["./data:/app/data"]
    restart: unless-stopped

  collector:
    build: ./dashboard
    command: node dist/collector.js
    volumes: ["./data:/app/data"]
    restart: unless-stopped
```

- Same Docker image for both services (multi-stage Alpine, ~150MB)
- Shared volume `./data` contains SQLite database
- Web serves on port 3100
- Collector has no exposed ports

## Design Quality Requirements

- All animations spring-based (stiffness 280-380, damping 28-32)
- No card hover effects (static, clean)
- Warm gray palette for FitBark themes (not pure grays)
- Cards: 14px border-radius, subtle shadow, inset highlight on dark themes
- Typography: Bricolage Grotesque for display/values, Inter for body
- All times 24-hour format
- Tabular-nums on numeric columns
- Use `frontend-design` skill during implementation for design polish
