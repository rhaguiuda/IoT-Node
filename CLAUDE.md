# Air Quality Node (IoT-Node)

Nó IoT que mede **CO2, temperatura e umidade** do laboratório e publica via MQTT.
Fluxo: `firmware (ESP32) → MQTT → collector → SQLite → dashboard (web) / menubar (macOS)`.

## Estrutura

| Pasta | O que é |
|-------|---------|
| `firmware/` | Firmware do microcontrolador (PlatformIO, Arduino) |
| `dashboard/` | Web (Next.js) + collector MQTT→SQLite, dockerizados |
| `menubar/` | App macOS de menu bar (Swift) |
| `docs/` | Specs e planos de design (`docs/superpowers/`) |
| `deploy.sh` | Deploy do dashboard para o Bee-Docker |

## firmware/

- **Placa:** ESP32-C3-DevKitM-1 · framework Arduino · sensor Sensirion SCD41 (I2C: SDA=GPIO4, SCL=GPIO6).
- Filtro de Kalman nos 3 sinais, watchdog 15 s, LED RGB neopixel (GPIO8).
- Build/flash:
  ```bash
  cd firmware
  pio run                    # compilar
  pio run --target upload    # flashear
  pio device monitor         # monitor serial (115200)
  ```
- **A melhorar:** SSID/senha do WiFi estão hardcoded em `firmware/src/main.cpp` — deveriam sair para config.

## dashboard/

- **Stack:** Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + Recharts + MQTT.js + better-sqlite3 + motion + lucide-react.
- **Dev local:**
  ```bash
  cd dashboard
  npm install
  npm run dev                # localhost:3000
  # em outro terminal: collector MQTT→SQLite
  npm run build:collector && node dist/index.js
  ```
- **Docker:** `docker-compose.yml` sobe dois serviços com a mesma imagem — `iot-air-quality-web` (Next.js, porta **3100**) e `iot-air-quality-collector` (subscriber MQTT). Imagem `node:22-alpine`, multi-stage.
- **Dados:** SQLite em `data/iotnode.db` (volume `./data:/app/data`, persiste entre deploys). Retenção 90 dias com purga automática. Tópicos `teras/iotnode/1/telemetry/{co2,temp,umi}`.
- **Env:** `MQTT_URL` (default `mqtt://192.168.100.224:1883`), `DB_PATH` (default `/app/data/iotnode.db`).

## menubar/

- Swift 5.9+, macOS 13+, dependência CocoaMQTT (SPM). Subscreve `teras/iotnode/1/telemetry/#`.
- Build: `cd menubar && swift build -c release` → `.build/release/AirQuality`. Empacotar em `build/AirQuality.app` e copiar para `/Applications/`.

## Deploy (`deploy.sh`, rodado no Mac)

Alvo: **Bee-Docker** (`192.168.100.224`). Passos:
1. `rsync` de `./dashboard/` → `Bee-Docker:/home/rhaguiuda/iotnode/dashboard/` (exclui `node_modules`, `.next`, `dist`, `data`).
2. SSH `docker compose up -d --build` no servidor.
3. Aguarda HTTP 200 em `http://192.168.100.224:3100/`.

O DB de produção **não** é sincronizado pelo rsync — vive no volume host e sobrevive aos deploys.

## Infra

Broker MQTT roda no Bee-Docker (`192.168.100.224:1883`, WebSocket `:8884`). Detalhes da infra Bee: skill `bee-infra`.
