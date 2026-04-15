# IoT Air Quality Node

Indoor air quality monitoring system with an ESP32-S2 sensor node, a real-time web dashboard, and a macOS menu bar app. Measures CO2, temperature, and humidity using a Sensirion SCD41 NDIR sensor, publishing telemetry over MQTT.

## Project Structure

```
IoT-Node/
├── firmware/      ← ESP32-S2 PlatformIO firmware
├── dashboard/     ← Next.js web dashboard + MQTT collector
├── menubar/       ← macOS menu bar app (Swift)
└── docs/          ← Design specs and plans
```

## Hardware

| Component | Description |
|---|---|
| **MCU** | Lolin S2 Mini (ESP32-S2) |
| **Framework** | Arduino via PlatformIO |
| **I2C Bus** | SDA = GPIO 37, SCL = GPIO 39 |
| **LED** | Built-in heartbeat on GPIO 15 (blinks to indicate the main loop is running) |

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

**Topic pattern:** `teras/iotnode/1/telemetry/<measurement>`

| Topic | Unit | Update Rate |
|---|---|---|
| `teras/iotnode/1/telemetry/co2` | ppm | ~5s |
| `teras/iotnode/1/telemetry/temp` | °C | ~5s |
| `teras/iotnode/1/telemetry/umi` | % | ~5s |

**Connection details:**
- **Client ID:** `AirQualityNode`
- **WiFi hostname:** `AirQualityNode`

## Reliability Features

- **Watchdog timer (30s)** — automatically resets the device if the main loop stops responding.
- **Non-blocking WiFi reconnection** — uses a 15-second timeout instead of blocking forever.
- **Non-blocking MQTT reconnection** — attempts to reconnect once every 5 seconds without blocking sensor reads.
- **I2C bus recovery** — if 10 consecutive I2C failures are detected, the firmware performs a clock-out recovery (16 SCL pulses + STOP condition) and reinitializes the sensor.
- **Heartbeat LED** — the built-in LED blinks at 1 Hz to provide a visual indication that the firmware is running.
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

The upload and monitor ports are configured in `platformio.ini` for the Lolin S2 Mini.

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
- **Update frequency:** every 10 seconds via `GET /api/trend`
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

**Menu bar:** `1143ppm  29.5°  45%` — all three values updated in real-time (~5s). CO₂ value is color-coded:
- **Normal** (< 1000 ppm) — system default color
- **Yellow** (1000–1500 ppm) — elevated
- **Red** (> 1500 ppm) — high

**Popover (click):** expanded view with metric rows, color-coded status indicators, last update timestamp, and a link to open the web dashboard.

### Build

Requires Swift 5.9+ and macOS 13+. Uses CocoaMQTT via Swift Package Manager.

```bash
cd menubar

# Debug build
swift build

# Release build
swift build -c release
```

### Install as .app

The release build is packaged as a macOS app bundle at `menubar/build/AirQuality.app`.

```bash
# Copy to Applications
cp -R menubar/build/AirQuality.app /Applications/

# Open
open /Applications/AirQuality.app
```

The app runs as a menu bar agent (`LSUIElement = true`) — no Dock icon. Add it to **System Settings → General → Login Items** to start automatically on boot.

### Architecture

- **MQTTClient.swift** — CocoaMQTT5 connection to `192.168.100.224:1883`, subscribes to `teras/iotnode/1/telemetry/#`, parses measurements, publishes to SwiftUI via `@Published` properties
- **AirQualityApp.swift** — `MenuBarExtra` entry point, renders values in menu bar label
- **PopoverView.swift** — expanded popover with metric rows, status colors, dashboard link

## Firmware Dependencies

| Library | Version | Purpose |
|---|---|---|
| `sensirion/Sensirion I2C SCD4x` | ^0.4.0 | SCD41 CO2 sensor driver |
| `knolleary/PubSubClient` | ^2.8 | MQTT client |
| `denyssene/SimpleKalmanFilter` | ^0.1.0 | Signal smoothing (light, q=0.5) |
