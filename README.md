# IoT Air Quality Node

Indoor air quality monitoring system with an ESP32-C3 sensor node, a real-time web dashboard, a macOS menu bar app, and an M5Stack Core2 bedside display. Measures CO2, temperature, and humidity using a Sensirion SCD41 NDIR sensor, publishing telemetry over MQTT.

## Project Structure

```
IoT-Node/
├── firmware/        ← ESP32-C3 sensor node (PlatformIO) — reads SCD41, publishes
├── firmware-core2/  ← M5Stack Core2 bedside NTP clock + display (consumes telemetry)
├── dashboard/       ← Next.js web dashboard + MQTT collector
├── menubar/         ← macOS menu bar app (Swift)
└── docs/            ← Design specs and plans
```

## Hardware

| Component | Description |
|---|---|
| **MCU** | ESP32-C3-DevKitM-1 |
| **Framework** | Arduino via PlatformIO |
| **I2C Bus** | SDA = GPIO 4, SCL = GPIO 6 |
| **LED** | RGB neopixel on GPIO 8 — **error indicator**: blinks red (~1 Hz) only when something is wrong (SCD41 off the bus, I2C failures, WiFi/MQTT down); off when healthy |

### Sensor

| Sensor | I2C Address | Measurements | Notes |
|---|---|---|---|
| **SCD41** (Sensirion) | 0x62 | CO2 (ppm), temperature (°C), humidity (%) | NDIR — measures real CO2 via infrared absorption. Updates every ~5 seconds. |

## Data Pipeline

```
SCD41 (I2C) → Kalman Filter → MQTT (EMQX broker)
                                     │
                                     ├── WebSocket (:8884) → Browser (real-time dashboard)
                                     ├── MQTT (:1883) → Collector → SQLite (history)
                                     └── MQTT (:1883) → macOS menu bar app (real-time)
```

Each sensor reading passes through a `SimpleKalmanFilter` (q=0.5, light smoothing) before being published.

## MQTT Topics

The node publishes telemetry to an EMQX broker over WiFi.

**Topic pattern:** `teras/iotnode/<device_id>/telemetry/<measurement>`, where `<device_id>` is the device's WiFi MAC (12-char lowercase hex, e.g. `e8069066185c`). The collector subscribes to the wildcard `teras/iotnode/+/telemetry/#`.

| Topic | Unit | Update Rate |
|---|---|---|
| `teras/iotnode/<device_id>/telemetry/co2` | ppm | ~5s |
| `teras/iotnode/<device_id>/telemetry/temp` | °C | ~5s |
| `teras/iotnode/<device_id>/telemetry/umi` | % | ~5s |

**Connection details (per device, derived from the WiFi MAC):**
- **Client ID:** `iotnode-<mac>` — unique per device; this is what prevents two nodes from disconnecting each other on the broker.
- **WiFi hostname:** `AirQualityNode-<mac>`

## Reliability Features

- **Watchdog timer (15s)** — automatically resets the device if the main loop stops responding.
- **Non-blocking WiFi reconnection** — uses a 15-second timeout instead of blocking forever.
- **Non-blocking MQTT reconnection** — attempts to reconnect once every 5 seconds without blocking sensor reads.
- **I2C bus recovery** — if 5 consecutive I2C failures are detected, the firmware performs a clock-out recovery (16 SCL pulses + STOP condition) and reinitializes the sensor.
- **Preventive auto-restart** — the device reboots itself every 24h to clear any slow resource leaks.
- **Error-indicator LED** — the RGB LED blinks red (~1 Hz) only when something is wrong (SCD41 off the bus, I2C failures, WiFi or MQTT disconnected). When everything is healthy the LED stays off.
- **Boot diagnostics** — tracks reset reason (power on, watchdog, brownout, panic) and boot count in NVS flash. Cumulative counters persist across reboots for debugging intermittent failures.
- **Periodic status line** — prints WiFi state, MQTT state, sensor status, free heap, uptime, and last reset reason every 10 seconds over serial.

## Firmware — Build & Flash

Requires [PlatformIO](https://platformio.org/). Firmware source is in `firmware/`.

```bash
cd firmware

# Compile
pio run

# Flash to device
pio run --target upload

# Monitor serial output (115200 baud)
pio device monitor
```

The upload and monitor ports are configured in `platformio.ini` for the ESP32-C3-DevKitM-1.

## Core2 Display Node (M5Stack)

A separate PlatformIO project (`firmware-core2/`, board `m5stack-core2`) that turns an M5Stack Core2 into a **bedside NTP clock with a smart screen**. It does **not** read a sensor — it subscribes to the existing nodes' telemetry and displays it live.

> **Why a consumer, not a producer:** the Core2 only exposes **5V** on its external ports (the 3.3V M-Bus pin is covered by the M5GO Bottom2), and the ESP32 GPIO is **not 5V-tolerant** — so a bare 3.3V SCD41 can't be wired to it safely. Instead of fighting that, the Core2 consumes the data the sensor nodes already publish.

**What it shows** (layout "Nightstand"): a large `HH:MM:SS` clock (Font7) + date, three chips (value on top, vector icon below) for CO₂/temp/humidity, and a top status row with MQTT, WiFi, and battery (charging bolt). CO₂ bands: green < 1000, yellow 1000–1500, red > 1500.

- **Time:** the BM8563 RTC keeps time in **UTC**; NTP (`<-03>3`, America/São_Paulo) resyncs every 60 min. TZ is set at boot so the display shows local time immediately. The first sync zeroes the clock before `configTzTime` so `getLocalTime` waits for the real SNTP packet (otherwise it returns the stale RTC value and the time visibly jumps). M5Unified reads the RTC as UTC — storing local time would break the offset.
- **Data:** subscribes to `teras/iotnode/+/telemetry/#` and shows the live values, `--` when the source goes silent (> 30s). `TARGET_DEVICE` (empty = any node) pins it to one device. It publishes nothing, so it never appears in the dashboard.
- **RGB bar** (M5GO Battery Bottom2, 10× SK6812 on **GPIO25**, powered by the bus 5V → needs `M5.Power.setExtOutput(true)`): a slow **breathing** effect (~5s, 5–100%) in the CO₂ band color. It follows the screen — off when the display is off (bedside). Brightness is scaled per frame (not `setBrightness`, which causes banding in Adafruit_NeoPixel).
- **Interaction:** tap the screen to toggle the display; **motion** (MPU6886 IMU) wakes it for 7s then auto-off. The PMU charge LED is disabled.

### Build & Flash

```bash
cd firmware-core2
pio run --target upload
```

The Core2 uses a CH9102 USB-serial chip (a different port from the C3's CP2102) — check `pio device list`. Extra libraries: `M5Unified`, `PubSubClient`, `Adafruit NeoPixel`.

## Dashboard

Real-time web dashboard built with Next.js 16, Recharts, and 14 selectable themes. Shows KPI cards with threshold indicators, trend arrows, and historical charts. Icons from Google Material Symbols.

### Chart interactions

Each of the three charts (CO₂, temperature, humidity) supports:

- **Scroll to zoom** — mouse wheel over a chart zooms in/out on the time axis, anchored at the cursor position. Zooming out fully clears the zoom automatically.
- **Reset zoom button** — appears in the card header when a zoom is active; clears the zoom on click. Zoom also resets automatically when the range preset changes.
- **Min / Avg / Max** — shown under each chart's title, computed over the visible interval. Updates live as you zoom.

### Status indicators

- **Sensor Online/Offline** — green if MQTT data received in the last 30 seconds, red otherwise
- **Broker** — green if WebSocket connection to EMQX is active, red if disconnected

### Trend indicators

Each KPI card shows a trend arrow (↑ ↓ —) comparing the average of the last 2 minutes vs the previous 2 minutes. Calculated server-side from SQLite, available immediately on page load.

| Metric | Deadband | Color (up) | Color (down) |
|---|---|---|---|
| CO₂ | < 5 ppm | Red (worsening) | Green (improving) |
| Temperature | < 0.3°C | Neutral | Neutral |
| Humidity | < 1.0% | Neutral | Neutral |

- **Minimum data:** 5 readings per window (~25s) before showing trend
- **Update frequency:** every 10 seconds via `GET /api/trend?device=<id>` (per selected device)
- **Null-safe:** ignores periods with insufficient data

### Run locally

```bash
cd dashboard
npm install
npm run dev          # http://localhost:3000
```

The collector (MQTT subscriber that persists data to SQLite) runs separately:

```bash
npm run build:collector
node dist/index.js
```

### Deploy

**Infrastructure:** Docker Compose on Bee-Docker (`192.168.100.224`).

```
Bee-Docker (192.168.100.224)
├── iot-air-quality-web        ← Next.js, port 3100
├── iot-air-quality-collector   ← MQTT subscriber → SQLite
├── emqx                       ← MQTT broker, ports 1883/8884/18083
└── data/iotnode.db            ← SQLite volume (persists across rebuilds)
```

**First deploy and updates:** run `./deploy.sh` from the project root. It rsyncs the code to Bee-Docker and rebuilds the containers.

```bash
./deploy.sh
```

The script:
1. Syncs files to `Bee-Docker:/home/rhaguiuda/iotnode/` via rsync (incremental)
2. Runs `sudo docker compose up -d --build` on the remote

**Containers:** one Docker image, two containers from it:
- **iot-air-quality-web** — Next.js standalone server on port 3100
- **iot-air-quality-collector** — Node.js process subscribing to MQTT, writing to SQLite

**SQLite volume:** mounted at `../data:/app/data`, lives on the host filesystem at `/home/rhaguiuda/iotnode/data/iotnode.db`. Survives container rebuilds and restarts. Only lost if manually deleted or `docker compose down -v` is used.

**Dashboard URL:** `http://192.168.100.224:3100`

### Data Storage

The collector persists every MQTT message to SQLite as it arrives (~3 inserts every 5 seconds):

| Measurement | Write frequency |
|---|---|
| co2 | ~1 every 5s |
| temp | ~1 every 5s |
| umi | ~1 every 5s |

**Retention:** 90 days. The collector purges older records on startup and every 24 hours.

**Schema (multi-device):** `readings(id, device_id, measurement, value, timestamp)` keyed by `device_id` (the WiFi MAC), plus `devices(device_id, name, first_seen, last_seen)` and `settings(key, value)`. Devices are auto-registered on first contact (name defaults to the id, editable in the dashboard Settings; the collector's upsert never overwrites the name). A device id is parsed from the topic on each message. On boot the collector runs an idempotent migration that adds `device_id` to legacy DBs and backfills old rows with `'1'`.

### Dashboard Downsampling

The dashboard API downsamples historical data based on the selected time range:

| Range | Downsampling | Real-time refresh |
|---|---|---|
| 1m – 6h | avg per 5s | Yes (every 10s) |
| 12h | avg per 10s | No |
| 24h | avg per 15s | No |
| 3d | avg per 30s | No |
| 7d | avg per 1 min | No |
| 14d | avg per 2 min | No |
| 30d | avg per 5 min | No |
| 60d | avg per 10 min | No |
| 90d | avg per 15 min | No |

### CO₂ Scale

| Range (ppm) | Level | Color |
|---|---|---|
| < 600 | Excelente | Green |
| 600–800 | Bom | Green |
| 800–1000 | Aceitável | Green |
| 1000–1200 | Alerta | Orange |
| 1200–1500 | Ruim | Red |
| 1500–2000 | Muito Ruim | Dark red |
| 2000–5000 | Péssimo | Darker red |
| > 5000 | Perigo | Darkest red |

The CO₂ KPI card includes a hover info popup showing this full scale.

## macOS Menu Bar App

Native Swift app that shows real-time CO₂, temperature, and humidity in the macOS menu bar. Connects directly to EMQX via MQTT (no backend needed).

### What it shows

**Menu bar:** `1143ppm  29.5°  45%` — all three values for the *selected device*, updated in real-time (~5s). CO₂ value is color-coded:
- **Normal** (< 1000 ppm) — system default color
- **Orange** (1000–1500 ppm) — elevated
- **Red** (> 1500 ppm) — high

**Popover (click):** expanded view with the selected device's name in the header, metric rows, color-coded status indicators, last update timestamp, a link to the web dashboard, and a **Configurações…** button.

**Multi-device:** the app subscribes to the wildcard `teras/iotnode/+/telemetry/#` and tracks every device live. Friendly names come from the dashboard's `GET /api/devices` (falls back to the raw MAC if the web is down). The **Configurações…** window lists the discovered devices and lets you pick which one the menu bar shows; the choice persists in `UserDefaults`. The first device to report is auto-selected until you pick one.

### Build

Requires Swift 5.9+ and macOS 13+. Uses CocoaMQTT via Swift Package Manager.

```bash
cd menubar

# Debug build
swift build

# Release build
swift build -c release

# Unit tests (topic parser)
swift test
```

### Install as .app

Use the packaging script — it builds, assembles the bundle from the versioned
`menubar/Info.plist`, signs it with the stable identity, and installs to
`/Applications`:

```bash
cd menubar
./package.sh                # build, sign, install, open
./package.sh --no-install   # build + sign the bundle only
```

`menubar/Info.plist` is the versioned source of truth for the bundle metadata
(bundle id, `LSUIElement`, Local Network usage string). The assembled
`build/AirQuality.app` is generated and gitignored. The script refuses to run if
the `Teras Air Quality Signing` identity is missing (see the Local Network note).

The app runs as a menu bar agent (`LSUIElement = true`) — no Dock icon. Add it to **System Settings → General → Login Items** to start automatically on boot.

> **⚠️ Local Network permission (macOS 15+).** The app talks to the broker on the LAN, so macOS gates it behind **Local Network** privacy. Two gotchas, both already handled in the code/build but worth knowing:
> - CocoaMQTT uses a raw BSD socket (`GCDAsyncSocket`), which macOS **blocks silently** (`No route to host`) and never prompts for. `MQTTClient` fires a tiny `NWConnection` probe to the broker at startup purely to trigger the Local Network prompt — `Network.framework` participates in the privacy flow, raw sockets don't.
> - The Local Network grant is keyed to the app's **code signature**, so the bundle is signed with a stable self-signed identity (`Teras Air Quality Signing`). Always sign every rebuild with the **same** identity, otherwise the grant breaks and you'll have to re-allow it. Ad-hoc signing (`-s -`) does **not** work — its signature changes every build, so the grant never sticks. The bundle id is `com.teras.airqualitynode`.
>
> On first launch you'll get a "find devices on your local network" prompt — allow it once. To create the signing identity (one-time): Keychain Access → Certificate Assistant → Create a Certificate → *Code Signing* type, named `Teras Air Quality Signing`.

### Architecture

- **AirQualityCore/** — `parseTopic()`, a pure function that splits a telemetry topic into `(deviceID, measurement)`. Lives in its own library target so it can be unit-tested (`Tests/AirQualityCoreTests`).
- **MQTTClient.swift** — CocoaMQTT5 connection to `192.168.100.224:1883`, subscribes to the wildcard `teras/iotnode/+/telemetry/#`, keeps per-device readings, discovers devices live, fetches friendly names from the dashboard API, and exposes the selected device's values via `@Published` properties. Also holds the `NWConnection` Local Network probe (see above).
- **AirQualityApp.swift** — `MenuBarExtra` entry point plus the `Configurações` `Window` scene.
- **PopoverView.swift** — expanded popover with metric rows, status colors, dashboard link, and the Configurações button.
- **ConfigView.swift** — device picker window (single-select list of discovered devices, friendly name + MAC).

## Firmware Dependencies

| Library | Version | Purpose |
|---|---|---|
| `sensirion/Sensirion I2C SCD4x` | ^0.4.0 | SCD41 CO2 sensor driver |
| `knolleary/PubSubClient` | ^2.8 | MQTT client |
| `denyssene/SimpleKalmanFilter` | ^0.1.0 | Signal smoothing (light, q=0.5) |
