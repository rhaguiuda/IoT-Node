# IoT Air Quality Node

Indoor air quality monitoring system with an ESP32-S2 sensor node and a real-time web dashboard. Measures CO2, temperature, and humidity using a Sensirion SCD41 NDIR sensor, publishing telemetry over MQTT.

## Project Structure

```
IoT-Node/
├── firmware/      ← ESP32-S2 PlatformIO firmware
├── dashboard/     ← Next.js web dashboard + MQTT collector
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
SCD41 (I2C) → Kalman Filter → MQTT (EMQX broker) → Dashboard
                                     │
                                     ├── WebSocket (:8884) → Browser (real-time)
                                     └── MQTT (:1883) → Collector → SQLite (history)
```

Each sensor reading passes through a `SimpleKalmanFilter` before being published, smoothing out noise while preserving trends.

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
- **Periodic status line** — prints WiFi state, MQTT state, sensor status, free heap, and uptime every 10 seconds over serial.

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

Real-time web dashboard built with Next.js 16, Recharts, and 14 selectable themes. Shows KPI cards with threshold indicators (CO2, Temperature, Humidity), historical charts, and a settings panel for Pushover alerts. Icons from Google Material Symbols.

### Status indicators

- **Sensor Online/Offline** — green if MQTT data received in the last 30 seconds, red otherwise
- **Broker** — green if WebSocket connection to EMQX is active, red if disconnected

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
- **iot-air-quality-collector** — Node.js process subscribing to MQTT, writing to SQLite, sending Pushover alerts

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

### Alerts (Pushover)

The collector can send push notifications via Pushover:
- **CO2 high** — triggers when CO2 exceeds threshold (default 1000 ppm), 15-minute cooldown
- **Sensor offline** — triggers when no data received for X minutes (default 5), 30-minute cooldown

Configure Pushover keys and thresholds in the Settings section of the dashboard.

## Firmware Dependencies

| Library | Version | Purpose |
|---|---|---|
| `sensirion/Sensirion I2C SCD4x` | ^0.4.0 | SCD41 CO2 sensor driver |
| `knolleary/PubSubClient` | ^2.8 | MQTT client |
| `denyssene/SimpleKalmanFilter` | ^0.1.0 | Signal smoothing (light, q=0.5) |
