# IoT Air Quality Node

Indoor air quality monitoring node that measures CO2, temperature, humidity, light levels, and volatile organic compounds. Built with an ESP32-S2 (Lolin S2 Mini) and four I2C sensors, publishing telemetry data over MQTT for visualization in Grafana.

## Hardware

| Component | Description |
|---|---|
| **MCU** | Lolin S2 Mini (ESP32-S2) |
| **Framework** | Arduino via PlatformIO |
| **I2C Bus** | SDA = GPIO 37, SCL = GPIO 39 |
| **LED** | Built-in heartbeat on GPIO 15 (blinks to indicate the main loop is running) |

### Sensors

| Sensor | I2C Address | Measurements | Notes |
|---|---|---|---|
| **SCD41** (Sensirion) | 0x62 | CO2 (ppm), temperature (°C), humidity (%) | NDIR — measures real CO2 via infrared absorption. Updates every ~5 seconds. |
| **ENS160** (ScioSense) | 0x53 | eCO2 (ppm), TVOC (ppb), AQI (1-5) | MOX — estimates CO2 equivalent from VOC/hydrogen readings. Not a direct CO2 measurement. |
| **SHT4x** (Sensirion) | 0x44 | Temperature (°C), humidity (%) | High-accuracy temp/humidity sensor. |
| **BH1750** (ROHM) | 0x23 | Illuminance (lux) | Ambient light sensor. |

Having both the SCD41 (real CO2) and ENS160 (estimated eCO2) allows direct comparison between the two measurement methods.

## Data Pipeline

```
Sensors (I2C) → Kalman Filter → MQTT (EMQX broker) → Grafana
```

Each sensor reading passes through an individual `SimpleKalmanFilter` before being published, smoothing out noise while preserving trends.

## MQTT Topics

The node publishes telemetry to an EMQX broker over WiFi. Each topic includes the sensor name to make the data source unambiguous.

**Topic pattern:** `teras/iotnode/1/telemetry/<sensor>/<measurement>`

| Topic | Sensor | Unit | Update Rate |
|---|---|---|---|
| `teras/iotnode/1/telemetry/scd41/co2` | SCD41 | ppm | ~5s |
| `teras/iotnode/1/telemetry/scd41/temp` | SCD41 | °C | ~5s |
| `teras/iotnode/1/telemetry/scd41/umi` | SCD41 | % | ~5s |
| `teras/iotnode/1/telemetry/ens160/eco2` | ENS160 | ppm | ~1s |
| `teras/iotnode/1/telemetry/ens160/tvoc` | ENS160 | ppb | ~1s |
| `teras/iotnode/1/telemetry/ens160/airq` | ENS160 | 1-5 | ~1s |
| `teras/iotnode/1/telemetry/sht4x/temp` | SHT4x | °C | ~1s |
| `teras/iotnode/1/telemetry/sht4x/umi` | SHT4x | % | ~1s |
| `teras/iotnode/1/telemetry/bh1750/lux` | BH1750 | lux | ~1s |

**Connection details:**
- **Client ID:** `AirQualityNode`
- **WiFi hostname:** `AirQualityNode`

## Reliability Features

The firmware includes several mechanisms to prevent the node from becoming unresponsive:

- **Watchdog timer (30s)** — automatically resets the device if the main loop stops responding.
- **Non-blocking WiFi reconnection** — uses a 15-second timeout instead of blocking forever. The main loop continues running during reconnection attempts.
- **Non-blocking MQTT reconnection** — attempts to reconnect once every 5 seconds without blocking sensor reads.
- **I2C bus recovery** — if 10 consecutive I2C failures are detected, the firmware performs a clock-out recovery (16 SCL pulses + STOP condition) and reinitializes all sensors.
- **Graceful sensor degradation** — if a sensor fails to initialize at boot, the others continue operating normally.
- **Heartbeat LED** — the built-in LED blinks at 1 Hz to provide a visual indication that the firmware is running.
- **Periodic status line** — prints WiFi state, MQTT state, sensor status, free heap, and uptime every 10 seconds over serial.

## Build & Flash

Requires [PlatformIO](https://platformio.org/).

```bash
# Compile
pio run

# Flash to device
pio run --target upload

# Monitor serial output (115200 baud)
pio device monitor
```

The upload and monitor ports are configured in `platformio.ini` for the Lolin S2 Mini.

## Dependencies

| Library | Version | Purpose |
|---|---|---|
| `claws/BH1750` | ^1.3.0 | Light sensor driver |
| `dfrobot/DFRobot_ENS160` | ^1.0.1 | Air quality sensor driver |
| `sensirion/arduino-sht` | ^1.2.6 | SHT4x temp/humidity driver |
| `sensirion/Sensirion I2C SCD4x` | ^0.4.0 | SCD41 CO2 sensor driver |
| `knolleary/PubSubClient` | ^2.8 | MQTT client |
| `denyssene/SimpleKalmanFilter` | ^0.1.0 | Signal smoothing |
