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
- Filtro de Kalman nos 3 sinais, watchdog 15 s, LED RGB neopixel (GPIO8) — flash vermelho curto (50 ms a cada 5 s).
- **Identidade do device:** derivada do MAC do WiFi (`esp_read_mac`), em hex minúsculo de 12 chars (ex.: `e8069066185c`). Esse id é o slot de device nos tópicos, e também o client id do MQTT (`iotnode-<mac>`) e o hostname (`AirQualityNode-<mac>`). O client id único **é o que evita a colisão** entre nodes no broker — dois devices com o mesmo client id se derrubam mutuamente.
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
- **Dados:** SQLite em `data/iotnode.db` (volume `./data:/app/data`, persiste entre deploys). Retenção 90 dias com purga automática.
- **Tópicos:** `teras/iotnode/<device_id>/telemetry/{co2,temp,umi}`, onde `<device_id>` é o MAC do device. O collector assina o wildcard `teras/iotnode/+/telemetry/#`.
- **Schema:** `readings(id, device_id, measurement, value, timestamp)` + `devices(device_id, name, first_seen, last_seen)` + `settings(key, value)`. Um device é auto-registrado em `devices` no primeiro contato (nome = o próprio id; editável no Settings, e o upsert do collector **nunca sobrescreve** o nome). Índice principal: `(device_id, measurement, timestamp)`.
- **Migração:** `collector/db.ts` roda uma migração idempotente no boot — adiciona `device_id` a DBs antigos e faz backfill das linhas legadas com `'1'` (o id hardcoded do firmware antigo). Histórico do device legado `'1'` foi posteriormente reatribuído ao MAC real do aparelho.
- **Env:** `MQTT_URL` (default `mqtt://192.168.100.224:1883`), `DB_PATH` (default `/app/data/iotnode.db`).
- **Multi-device no front:** seletor de device no Header — escondido com 1 device (mostra só o nome), combo box com 2+. Seleção persistida em `localStorage`. API: `device` obrigatório em `/api/telemetry` e `/api/trend`; `/api/devices` lista (GET) e renomeia (PATCH).

## menubar/

- Swift 5.9+, macOS 13+, dependência CocoaMQTT (SPM). Subscreve `teras/iotnode/1/telemetry/#`.
- **⚠️ Ainda single-device:** o menubar continua hardcoded ao tópico `/1/` e **não foi atualizado para multi-device**. Como o device real agora publica sob seu MAC (não `/1/`), o menubar não recebe dados até ser portado (assinar `+`, escolher/fixar um device).
- Build: `cd menubar && swift build -c release` → `.build/release/AirQuality`. Empacotar em `build/AirQuality.app` e copiar para `/Applications/`.

## Deploy (`deploy.sh`, rodado no Mac)

Alvo: **Bee-Docker** (`192.168.100.224`). Passos:
1. `rsync` de `./dashboard/` → `Bee-Docker:/home/rhaguiuda/iotnode/dashboard/` (exclui `node_modules`, `.next`, `dist`, `data`).
2. SSH `docker compose up -d --build` no servidor.
3. Aguarda HTTP 200 em `http://192.168.100.224:3100/`.

O DB de produção **não** é sincronizado pelo rsync — vive no volume host e sobrevive aos deploys.

## Infra

Broker MQTT roda no Bee-Docker (`192.168.100.224:1883`, WebSocket `:8884`). Detalhes da infra Bee: skill `bee-infra`.
