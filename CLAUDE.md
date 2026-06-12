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

- Swift 5.9+, macOS 13+, dependência CocoaMQTT (SPM). **Multi-device:** assina o wildcard `teras/iotnode/+/telemetry/#`, rastreia todos os devices ao vivo, e exibe na barra os valores do device **selecionado**. Nomes amigáveis vêm de `GET /api/devices` do dashboard (fallback pro MAC). Janela **Configurações…** (cena `Window` `id "config"`) lista os devices e deixa escolher qual aparece na barra; seleção persiste em `UserDefaults`. Parser de tópico isolado em `AirQualityCore/` (target de lib) com testes em `Tests/AirQualityCoreTests` (`swift test`).
- Build/empacotar/instalar:
  ```bash
  cd menubar
  swift build -c release
  cp .build/release/AirQuality build/AirQuality.app/Contents/MacOS/AirQuality
  codesign --force --sign "Teras Air Quality Signing" build/AirQuality.app   # SEMPRE assinar (ver abaixo)
  cp -R build/AirQuality.app /Applications/ && open /Applications/AirQuality.app
  ```

### ⚠️⚠️ Armadilha de Rede Local do macOS (CRÍTICO — leia antes de mexer no menubar)

**Custou ~1h30 de debug em 2026-06-12. Não regredir. Se o app "parar de receber dados", quase certamente é isto.**

**Sintoma:** o app instalado em `/Applications` (aberto via `open`/Finder/Login Items) **não recebe nenhum dado** — a janela Configurações mostra "nenhum sensor". Porém o **mesmo binário** rodado direto pelo terminal (`.build/release/AirQuality` ou `/Applications/AirQuality.app/Contents/MacOS/AirQuality`) **funciona**. O log interno mostra `didDisconnect err=... Code=65 "No route to host"` ~60-80ms após o connect, num IP da LAN que está perfeitamente acessível.

**Por que terminal funciona e app instalado não:** é privacidade de **Rede Local** (TCC, macOS 15+). Rodado pelo terminal, o processo responsável é o Terminal, que já tem permissão de rede local → herda. Lançado via LaunchServices, o app é seu próprio processo responsável e precisa da permissão própria. `No route to host` num IP local, app-específico, é a **assinatura clássica do bloqueio de Rede Local** — não é roteamento de rede.

**As DUAS causas-raiz (ambas já corrigidas no código/build):**

1. **Socket cru não dispara o prompt.** O CocoaMQTT conecta via `GCDAsyncSocket` (socket BSD cru). O macOS **bloqueia socket cru em silêncio** e **nunca mostra o prompt** de Rede Local nem registra o app na lista — então não há o que conceder, faça o que fizer. Só APIs de alto nível (Network.framework / Bonjour) disparam o prompt. **Correção:** `MQTTClient.triggerLocalNetworkPermission()` dispara uma sondagem `NWConnection` curta ao broker no startup, só pra forçar o prompt a aparecer e registrar o app. A permissão concedida vale pro **app inteiro** (não por API), então o socket do CocoaMQTT passa a conectar. **NÃO remover essa sondagem** — sem ela o prompt nunca aparece.

2. **A permissão gruda na ASSINATURA de código.** O TCC de Rede Local atribui a permissão pela identidade de assinatura do app. **Ad-hoc (`codesign -s -`) NÃO funciona**: a assinatura ad-hoc (cdhash) muda a cada build/re-sign, então a permissão nunca cola e o prompt nem reaparece. **Correção:** assinar com uma identidade self-signed **estável**, `Teras Air Quality Signing` (no login keychain). **Todo rebuild tem que ser assinado com a MESMA identidade**, senão a permissão quebra e tem que reconceder.

**O que NÃO funciona (becos sem saída já testados — não repetir):**
- Ligar/religar o toggle na lista de Rede Local quando a entrada é de uma assinatura antiga (não casa com o processo atual).
- `tccutil reset All com.<bundle>` — **não mexe** em Rede Local nesse macOS (entradas continuam lá).
- Trocar o bundle id sozinho — sem a sondagem NWConnection, continua sem prompt.
- Assinatura ad-hoc, mesmo com bundle id limpo — sem prompt.
- App como foreground (sem `LSUIElement`) — não era o problema; o problema era o socket cru.

**Setup do certificado (uma vez):** Keychain Access → Assistente de Certificado → Criar um Certificado → tipo **Code Signing**, nome `Teras Air Quality Signing`. (Aparece como `CSSMERR_TP_NOT_TRUSTED` em `security find-identity -v`, mas **assina mesmo assim** — confiança importa pra verificação, não pra assinar.)

**Recuperação se quebrar no futuro:** confirme que (a) a sondagem NWConnection ainda está no `MQTTClient`, (b) o build foi assinado com `Teras Air Quality Signing`. Rode o binário pelo terminal pra isolar (se funciona no terminal mas não instalado = é Rede Local). Reabra o app instalado e conceda o prompt. Bundle id atual: `com.teras.airqualitynode` (o antigo `com.teras.airquality` deixou 2 entradas órfãs na lista de Rede Local — inofensivas, a UI não remove).

> **Nota de fragilidade:** `menubar/build` está no `.gitignore`, então o `Info.plist` do bundle (bundle id, `NSLocalNetworkUsageDescription`, `LSUIElement`) **não é versionado** — num checkout limpo essa config se perde. Pendente: mover um `Info.plist` fonte pra fora de `build/` + script de empacotamento.

## Deploy (`deploy.sh`, rodado no Mac)

Alvo: **Bee-Docker** (`192.168.100.224`). Passos:
1. `rsync` de `./dashboard/` → `Bee-Docker:/home/rhaguiuda/iotnode/dashboard/` (exclui `node_modules`, `.next`, `dist`, `data`).
2. SSH `docker compose up -d --build` no servidor.
3. Aguarda HTTP 200 em `http://192.168.100.224:3100/`.

O DB de produção **não** é sincronizado pelo rsync — vive no volume host e sobrevive aos deploys.

## Infra

Broker MQTT roda no Bee-Docker (`192.168.100.224:1883`, WebSocket `:8884`). Detalhes da infra Bee: skill `bee-infra`.
