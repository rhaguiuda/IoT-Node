# Air Quality Node (IoT-Node)

Nó IoT que mede **CO2, temperatura e umidade** do laboratório e publica via MQTT.
Fluxo: `firmware (ESP32) → MQTT → collector → SQLite → dashboard (web) / menubar (macOS)`.

## Estrutura

| Pasta | O que é |
|-------|---------|
| `firmware/` | Firmware do nó sensor (ESP32-C3, PlatformIO, Arduino) — lê o SCD41 e publica |
| `firmware-core2/` | Firmware do M5Stack Core2 — relógio NTP + display que **consome** a telemetria (não lê sensor) |
| `dashboard/` | Web (Next.js) + collector MQTT→SQLite, dockerizados |
| `menubar/` | App macOS de menu bar (Swift) |
| `docs/` | Specs e planos de design (`docs/superpowers/`) |
| `deploy.sh` | Deploy do dashboard para o Bee-Docker |

## firmware/

- **Placa:** ESP32-C3-DevKitM-1 · framework Arduino · sensor Sensirion SCD41 (I2C: SDA=GPIO4, SCL=GPIO6).
- Filtro de Kalman nos 3 sinais, watchdog 15 s, LED RGB neopixel (GPIO8) como **indicador de erro**: pisca vermelho (~1 Hz) **só quando algo está errado** — sensor SCD41 fora do barramento, falhas de I2C, WiFi ou MQTT desconectados. Com tudo OK o LED fica **apagado** (não é mais heartbeat de atividade).
- **Identidade do device:** derivada do MAC do WiFi (`esp_read_mac`), em hex minúsculo de 12 chars (ex.: `e8069066185c`). Esse id é o slot de device nos tópicos, e também o client id do MQTT (`iotnode-<mac>`) e o hostname (`AirQualityNode-<mac>`). O client id único **é o que evita a colisão** entre nodes no broker — dois devices com o mesmo client id se derrubam mutuamente.
- Build/flash:
  ```bash
  cd firmware
  pio run                    # compilar
  pio run --target upload    # flashear
  pio device monitor         # monitor serial (115200)
  ```
- **A melhorar:** SSID/senha do WiFi estão hardcoded em `firmware/src/main.cpp` — deveriam sair para config.

## firmware-core2/

Projeto PlatformIO **separado** (board `m5stack-core2`). O Core2 **não lê sensor** — é um **relógio NTP de cabeceira com tela inteligente** que assina a telemetria dos nós de ar existentes e a exibe. Surgiu porque o Core2 só expõe **5V** nas portas externas (Grove/M-Bus coberto) e o GPIO do ESP32 não é 5V-tolerant, inviabilizando ligar o SCD41 cru nele — então virou consumidor, não produtor.

- **Relógio:** RTC **BM8563** guarda a hora em **UTC**; NTP ressincroniza a cada 60 min. O TZ (`<-03>3`, America/São_Paulo) é setado **no boot**, então o display já nasce em hora local. Na 1ª sync, **zera o relógio antes** do `configTzTime` pra forçar o `getLocalTime` a esperar o pacote NTP real (senão ele retorna o valor velho do RTC na hora e a hora "salta"). M5Unified lê o RTC como UTC — gravar local quebra o fuso.
- **Dados:** assina `teras/iotnode/+/telemetry/#` (mesmo wildcard do collector/menubar) e mostra CO₂/temp/umidade ao vivo (`--` se a fonte ficar muda >30 s). `TARGET_DEVICE` (vazio = qualquer nó) trava num device específico. Não publica telemetria → não aparece no dashboard.
- **Tela (layout "Nightstand"):** relógio `HH:MM:SS` (Font7) + data + 3 chips (valor em cima, ícone vetorial embaixo); topo com MQTT + WiFi + bateria (raio ao carregar). Faixas de CO₂: verde <1000 / amarelo 1000–1500 / vermelho >1500.
- **Fita RGB** (M5GO Battery Bottom2, 10× SK6812 no **GPIO25**, alimentada pelo **5V do bus** → precisa de `M5.Power.setExtOutput(true)`): **breathing** lento (5 s, 5–100%) na cor da faixa do CO₂. Acompanha a tela (apaga junto — uso de cabeceira). Brilho escalado por frame (não `setBrightness`, que dá banding no Adafruit_NeoPixel).
- **Interação:** tap na tela liga/desliga; **movimento** (IMU MPU6886) acende por 7 s e auto-apaga (`MOTION_THRESH`). LED de carga do PMU desligado (`setLed(0)`).
- Deps extras: `M5Unified`, `PubSubClient`, `Adafruit NeoPixel`. Porta serial (CH9102) ≠ a do C3 (CP2102) — conferir `pio device list`.
- Build/flash:
  ```bash
  cd firmware-core2
  pio run --target upload
  ```

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
- **Schema:** `readings(id, device_id, measurement, value, timestamp)` + `devices(device_id, name, first_seen, last_seen)` + `settings(key, value)`. Um device é auto-registrado em `devices` no primeiro contato (nome = o próprio id, o que conta como "sem nome"; renomeável pelo lápis no Header ou no Settings, e o upsert do collector **nunca sobrescreve** o nome). Índice principal: `(device_id, measurement, timestamp)`.
- **Migração:** `collector/db.ts` roda uma migração idempotente no boot — adiciona `device_id` a DBs antigos e faz backfill das linhas legadas com `'1'` (o id hardcoded do firmware antigo). Histórico do device legado `'1'` foi posteriormente reatribuído ao MAC real do aparelho.
- **Env:** `MQTT_URL` (default `mqtt://192.168.100.224:1883`), `DB_PATH` (default `/app/data/iotnode.db`).
- **Nome de exibição do device (`deviceLabel` em `lib/types.ts`):** device **com nome custom → mostra só o nome**; **sem nome → mostra o MAC**. "Sem nome" = `name` vazio ou igual ao `device_id` (o default gravado pelo collector). Usar `deviceLabel()` em todo lugar que exibe device — nunca concatenar MAC+nome.
- **Multi-device no front:** o **título do Header** mostra o `deviceLabel` do device selecionado + um **lápis** que renomeia **inline** (Enter salva, Esc cancela, blur salva; campo vazio → reseta pro MAC). O **seletor** (dropdown) só aparece com **2+ devices** (com 1, o título já basta). Seleção persistida em `localStorage`. Também dá pra renomear no Settings (mesma API).
- **API devices:** `/api/devices` lista (GET) e renomeia (PATCH `{device_id, name}`). **Nome vazio no PATCH reseta pro `device_id`** (volta a "sem nome" → exibe MAC). `device` é obrigatório em `/api/telemetry` e `/api/trend`.

## menubar/

- Swift 5.9+, macOS 13+, dependência CocoaMQTT (SPM). **Multi-device:** assina o wildcard `teras/iotnode/+/telemetry/#`, rastreia todos os devices ao vivo, e exibe na barra os valores do device **selecionado**. Nomes amigáveis vêm de `GET /api/devices` do dashboard (fallback pro MAC). Janela **Configurações…** (cena `Window` `id "config"`) lista os devices e deixa escolher qual aparece na barra; seleção persiste em `UserDefaults`. Parser de tópico isolado em `AirQualityCore/` (target de lib) com testes em `Tests/AirQualityCoreTests` (`swift test`).
- Build/empacotar/instalar: **use `menubar/package.sh`** (build + monta o bundle a partir de `menubar/Info.plist` + assina com o cert estável + instala). Recusa rodar se o cert não existir. `./package.sh` (instala) ou `./package.sh --no-install`. **Não fazer mais `cp`/`codesign` na mão** — o script garante a assinatura correta.
- **`menubar/Info.plist` é a fonte versionada** do metadado do bundle (bundle id `com.teras.airqualitynode`, `LSUIElement`, `NSLocalNetworkUsageDescription`). O `build/AirQuality.app` é gerado e fica no `.gitignore` — o script o remonta. Editar metadado do bundle = editar `menubar/Info.plist`, não o `.app`.

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

**Recuperação se quebrar no futuro:** confirme que (a) a sondagem NWConnection ainda está no `MQTTClient`, (b) o build foi assinado com `Teras Air Quality Signing` (o `package.sh` garante isso). Rode o binário pelo terminal pra isolar (se funciona no terminal mas não instalado = é Rede Local). Reabra o app instalado e conceda o prompt. Bundle id atual: `com.teras.airqualitynode` (o antigo `com.teras.airquality` deixou entradas órfãs na lista de Rede Local — inofensivas; a UI não remove e o `tccutil` não reseta Rede Local, só dá pra limpar apagando `/Library/Preferences/com.apple.networkextension.*.plist` em modo Recovery, o que zera a lista toda).

## Deploy (`deploy.sh`, rodado no Mac)

Alvo: **Bee-Docker** (`192.168.100.224`). Passos:
1. `rsync` de `./dashboard/` → `Bee-Docker:/home/rhaguiuda/iotnode/dashboard/` (exclui `node_modules`, `.next`, `dist`, `data`).
2. SSH `docker compose up -d --build` no servidor.
3. Aguarda HTTP 200 em `http://192.168.100.224:3100/`.

O DB de produção **não** é sincronizado pelo rsync — vive no volume host e sobrevive aos deploys.

## Infra

Broker MQTT roda no Bee-Docker (`192.168.100.224:1883`, WebSocket `:8884`). Detalhes da infra Bee: skill `bee-infra`.
