// IoT Air Quality Node — M5Stack Core2
// Layout "Nightstand": relogio (heroi) HH:MM:SS + data + 3 chips (CO2 / temp /
// umidade) com icones vetoriais. Topo: MQTT + wifi + bateria.
//  - Relogio: RTC (BM8563, em UTC) + NTP a cada NTP_SYNC_MS.
//  - Tap na tela liga/desliga o backlight (uso de cabeceira).
//  - MQTT: assina a telemetria dos nos de ar EXISTENTES
//    (teras/iotnode/+/telemetry/#) e exibe CO2/temp/umidade ao vivo.
//    Este no NAO le sensor — e um relogio NTP com tela "inteligente".

#include <M5Unified.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_NeoPixel.h>
#include <esp_mac.h>
#include <time.h>

// --- Rede / hora ---
#define WIFI_SSID        "NHag"
#define WIFI_PASSWORD    ".!navio@"
#define MQTT_SERVER      "192.168.100.224"
#define MQTT_PORT        1883
#define MQTT_RETRY_MS    5000
#define TZ_INFO          "<-03>3"          // America/Sao_Paulo (UTC-3, sem horario de verao)
#define NTP_SERVER1      "a.st1.ntp.br"
#define NTP_SERVER2      "pool.ntp.org"
#define NTP_SYNC_MS      (60UL * 60UL * 1000UL)

// --- Wake por movimento (IMU) ---
#define MOTION_THRESH  0.35f   // soma de |delta accel| (g) p/ considerar "movido"
#define WAKE_MS        7000    // tempo aceso apos o movimento

// --- Fonte dos dados: telemetria MQTT dos nos de ar existentes ---
#define MQTT_TOPIC_SUB  "teras/iotnode/+/telemetry/#"
#define TARGET_DEVICE   ""        // vazio = qualquer no; ou fixe um device_id (MAC) p/ travar num so
#define DATA_STALE_MS   30000     // sem dado por 30s -> mostra "--" (fonte offline)

// --- Fita RGB do M5GO Battery Bottom2 (10x SK6812 no GPIO25, alimentada pelo 5V do bus) ---
#define LED_PIN         25
#define LED_COUNT       10
#define LED_BRIGHTNESS  30        // brilho baixo (cabeceira)
#define BREATH_PERIOD_MS 5000     // ciclo do "breathing" (5s)
#define BREATH_MIN       0.05f    // brilho minimo do ciclo (5%)

// --- Paleta (565) ---
#define C_TEXT    canvas.color565(233,238,243)
#define C_MUTED   canvas.color565(130,141,155)
#define C_SURF    canvas.color565(22,28,38)
#define C_LINE    canvas.color565(40,50,63)
#define C_GOOD    canvas.color565(54,194,107)
#define C_WARN    canvas.color565(242,163,60)
#define C_CRIT    canvas.color565(240,82,75)
#define C_DROP    canvas.color565(91,184,232)

M5Canvas canvas(&M5.Display);
WiFiClient   espClient;
PubSubClient mqtt(espClient);
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

// Identidade por MAC (mesmo esquema do firmware C3)
char deviceId[13]     = "000000000000";
char mqttClientId[32] = "iotnode";

bool          displayOn      = true;
uint8_t       brightnessOn   = 110;
unsigned long lastDraw       = 0;
unsigned long lastNtpSync    = 0;
unsigned long lastMqttRetry  = 0;
bool          wifiConnected  = false;
bool          mqttConnected  = false;
bool          ntpSynced      = false;
char          lastSyncLabel[8] = "--:--";

// estado do wake por movimento
bool          autoWake       = false;   // tela acesa por movimento (vai apagar sozinha)
unsigned long wakeUntil      = 0;
float         pax = 0, pay = 0, paz = 0; // ultima leitura do acelerometro

// leituras recebidas via MQTT (telemetria dos nos de ar)
float         co2Val = NAN, tempVal = NAN, humVal = NAN;
unsigned long lastDataMs = 0;
char          srcDevice[13] = "";

const char* DIAS[]  = {"Dom","Seg","Ter","Qua","Qui","Sex","Sab"};
const char* MESES[] = {"jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"};

uint16_t co2Color(int ppm) {
    if (ppm < 1000)  return C_GOOD;
    if (ppm <= 1500) return C_WARN;
    return C_CRIT;
}

// Fita RGB segue a tela: apaga junto com o display; quando aceso, mostra a
// faixa do CO2 (verde/laranja/vermelho). Sem dado fresco -> apagada.
void updateLeds() {
    bool fresh = (lastDataMs != 0) && (millis() - lastDataMs < DATA_STALE_MS);
    if (!displayOn || !fresh || isnan(co2Val)) {
        strip.clear();
        strip.show();
        return;
    }
    int ppm = (int)co2Val;
    uint8_t r, g, b;
    if      (ppm < 1000)  { r = 0;   g = 255; b = 0; }   // verde
    else if (ppm <= 1500) { r = 255; g = 170; b = 0; }   // amarelo
    else                  { r = 255; g = 0;   b = 0; }   // vermelho
    // breathing: brilho oscila BREATH_MIN..1.0 num cosseno; escala a cor (nao usa
    // setBrightness repetido p/ evitar banding do Adafruit_NeoPixel)
    float ph = 2.0f * PI * (millis() % BREATH_PERIOD_MS) / (float)BREATH_PERIOD_MS;
    float f = BREATH_MIN + (1.0f - BREATH_MIN) * (0.5f - 0.5f * cosf(ph));
    strip.fill(strip.Color((uint8_t)(r * f), (uint8_t)(g * f), (uint8_t)(b * f)));
    strip.show();
}

// --- Icones vetoriais ---
void icoCloud(int x, int y, uint16_t c) {          // CO2 (caixa ~22x22)
    int by = y + 16;
    canvas.fillCircle(x + 7,  by - 4, 5, c);
    canvas.fillCircle(x + 14, by - 6, 6, c);
    canvas.fillCircle(x + 18, by - 2, 4, c);
    canvas.fillRoundRect(x + 3, by - 2, 17, 5, 2, c);
}
void icoThermo(int x, int y, uint16_t c) {
    int cx = x + 11;
    canvas.drawRoundRect(cx - 4, y + 1, 8, 13, 4, c);
    canvas.fillCircle(cx, y + 17, 5, c);
    canvas.fillRect(cx - 1, y + 7, 3, 8, c);
}
void icoDrop(int x, int y, uint16_t c) {
    int cx = x + 11;
    canvas.fillCircle(cx, y + 15, 6, c);
    canvas.fillTriangle(cx, y + 2, cx - 6, y + 14, cx + 6, y + 14, c);
}
void icoWifi(int cx, int cy, uint16_t c) {
    canvas.drawArc(cx, cy, 9, 7, 215, 325, c);
    canvas.drawArc(cx, cy, 5, 3, 215, 325, c);
    canvas.fillCircle(cx, cy, 1, c);
}
// nuvem pequena = link MQTT (verde conectado / cinza nao)
void icoMqtt(int cx, int cy, uint16_t c) {
    canvas.fillCircle(cx - 5, cy + 1, 4, c);
    canvas.fillCircle(cx + 1, cy - 1, 5, c);
    canvas.fillCircle(cx + 5, cy + 1, 4, c);
    canvas.fillRoundRect(cx - 8, cy + 1, 16, 4, 2, c);
}
void icoBattery(int x, int y, int level, bool charging) {
    int bw = 24, bh = 12;
    uint16_t col = charging ? C_GOOD
                 : (level <= 15 ? C_CRIT : (level <= 35 ? C_WARN : C_TEXT));
    canvas.drawRoundRect(x, y, bw, bh, 3, C_MUTED);
    canvas.fillRect(x + bw + 1, y + 4, 2, bh - 8, C_MUTED);
    int innerW = bw - 4;
    int fillW = level > 0 ? (innerW * level) / 100 : 0;
    if (fillW > 0) canvas.fillRoundRect(x + 2, y + 2, fillW, bh - 4, 2, col);
    if (charging) {                                            // raio amarelo
        uint16_t bolt = canvas.color565(255, 205, 40);
        int bx = x + bw / 2, by = y + bh / 2;
        canvas.fillTriangle(bx, by - 5, bx - 3, by + 1, bx + 1, by + 1, bolt);
        canvas.fillTriangle(bx, by + 5, bx + 3, by - 1, bx - 1, by - 1, bolt);
    }
}

void buildDeviceIdentity() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    snprintf(deviceId, sizeof(deviceId), "%02x%02x%02x%02x%02x%02x",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    snprintf(mqttClientId, sizeof(mqttClientId), "iotnode-%s", deviceId);
}

void seedClockFromRtc() {
    M5.Rtc.setSystemTimeFromRtc();   // RTC esta em UTC; TZ aplica o offset
}

// grava a hora atual (UTC) no RTC; M5Unified le o RTC como UTC.
void storeRtcAndLabel(struct tm& tl) {
    time_t now = time(nullptr);
    struct tm utc; gmtime_r(&now, &utc);
    M5.Rtc.setDateTime(m5::rtc_datetime_t(utc));
    strftime(lastSyncLabel, sizeof(lastSyncLabel), "%H:%M", &tl);
}

void syncNtp() {
    lastNtpSync = millis();
    if (WiFi.status() != WL_CONNECTED) return;

    if (!ntpSynced) {
        // PRIMEIRA sync: zera o relogio p/ FORCAR getLocalTime a esperar o pacote
        // NTP real. Com o relogio ja valido (vindo do RTC), ele retornaria o valor
        // velho na hora -> era a causa do "salto" de hora.
        time_t saved = time(nullptr);
        unsigned long t0 = millis();
        struct timeval z = { 0, 0 };
        settimeofday(&z, nullptr);
        configTzTime(TZ_INFO, NTP_SERVER1, NTP_SERVER2);
        struct tm tl;
        if (getLocalTime(&tl, 10000)) {        // bloqueia ate o NTP setar ano valido
            storeRtcAndLabel(tl);
            ntpSynced = true;
            Serial.printf("[NTP] sync OK local=%02d:%02d:%02d\n", tl.tm_hour, tl.tm_min, tl.tm_sec);
        } else {
            struct timeval r = { saved + (time_t)((millis() - t0) / 1000), 0 };
            settimeofday(&r, nullptr);          // sem resposta: restaura o relogio
            Serial.println("[NTP] sem resposta, relogio restaurado");
        }
    } else {
        // RESYNC: relogio ja correto; SNTP refina em background (nao trava o loop).
        configTzTime(TZ_INFO, NTP_SERVER1, NTP_SERVER2);
        struct tm tl;
        if (getLocalTime(&tl, 1000)) storeRtcAndLabel(tl);
        Serial.println("[NTP] resync");
    }
}

// topico: teras/iotnode/<device_id>/telemetry/<co2|temp|umi>  payload = valor
void mqttCallback(char* topic, byte* payload, unsigned int len) {
    char val[16];
    if (len >= sizeof(val)) len = sizeof(val) - 1;
    memcpy(val, payload, len);
    val[len] = '\0';
    float v = atof(val);

    const char* prefix = "teras/iotnode/";
    if (strncmp(topic, prefix, 14) != 0) return;
    const char* d = topic + 14;
    const char* slash = strchr(d, '/');
    if (!slash) return;
    int dlen = slash - d;
    if (dlen <= 0 || dlen > 12) return;
    char dev[13];
    memcpy(dev, d, dlen);
    dev[dlen] = '\0';
    if (strlen(TARGET_DEVICE) && strcmp(dev, TARGET_DEVICE) != 0) return;   // filtro opcional

    const char* meas = strrchr(topic, '/');
    if (!meas) return;
    meas++;
    if      (!strcmp(meas, "co2"))  co2Val  = v;
    else if (!strcmp(meas, "temp")) tempVal = v;
    else if (!strcmp(meas, "umi"))  humVal  = v;
    else return;
    lastDataMs = millis();
    strncpy(srcDevice, dev, sizeof(srcDevice));
}

void handleMqtt() {
    if (WiFi.status() != WL_CONNECTED) { mqttConnected = false; return; }
    if (mqtt.connected()) { mqtt.loop(); mqttConnected = true; return; }
    mqttConnected = false;
    if (millis() - lastMqttRetry < MQTT_RETRY_MS) return;
    lastMqttRetry = millis();
    if (mqtt.connect(mqttClientId)) {
        mqttConnected = true;
        mqtt.subscribe(MQTT_TOPIC_SUB);     // passa a receber a telemetria dos nos
        Serial.printf("[MQTT] conectado (%s) + subscribe %s\n", mqttClientId, MQTT_TOPIC_SUB);
    } else {
        Serial.printf("[MQTT] falhou rc=%d\n", mqtt.state());
    }
}

void drawChip(int x, int w, void (*ico)(int,int,uint16_t), uint16_t icoCol,
              const char* value, uint16_t valCol) {
    int y = 130, h = 96;
    canvas.fillRoundRect(x, y, w, h, 12, C_SURF);
    canvas.drawRoundRect(x, y, w, h, 12, C_LINE);
    int cx = x + w / 2;
    canvas.setTextDatum(middle_center);
    canvas.setFont(&fonts::FreeSansBold18pt7b);
    canvas.setTextColor(valCol);
    canvas.drawString(value, cx, y + 34);    // valor em cima
    ico(cx - 11, y + 56, icoCol);            // icone embaixo
}

void drawUI() {
    canvas.fillScreen(TFT_BLACK);

    struct tm ti;
    bool haveTime = getLocalTime(&ti, 5);

    // --- Relogio (heroi) HH:MM:SS ---
    canvas.setTextDatum(middle_center);
    canvas.setTextColor(C_TEXT);
    canvas.setFont(&fonts::Font7);
    canvas.setTextSize(1);
    char clk[12];
    if (haveTime) strftime(clk, sizeof(clk), "%H:%M:%S", &ti);
    else          strcpy(clk, "--:--:--");
    canvas.drawString(clk, 160, 58);

    // --- Data ---
    canvas.setFont(&fonts::FreeSansBold12pt7b);
    canvas.setTextColor(C_MUTED);
    if (haveTime) {
        char datebuf[24];
        snprintf(datebuf, sizeof(datebuf), "%s, %02d %s",
                 DIAS[ti.tm_wday], ti.tm_mday, MESES[ti.tm_mon]);
        canvas.drawString(datebuf, 160, 110);
    }

    // --- Topo-direito: MQTT  wifi  XX%  bateria (espacados) ---
    icoMqtt(196, 14, mqttConnected ? C_GOOD : C_LINE);
    icoWifi(228, 18, wifiConnected ? C_GOOD : C_LINE);   // cy=18 alinha o centro com nuvem/bateria
    int lvl = M5.Power.getBatteryLevel();
    bool chg = M5.Power.isCharging();
    char pbuf[6];
    if (lvl >= 0) snprintf(pbuf, sizeof(pbuf), "%d%%", lvl);
    else          strcpy(pbuf, "--");
    canvas.setFont(&fonts::FreeSans9pt7b);
    canvas.setTextDatum(middle_right);
    canvas.setTextColor(C_MUTED);
    canvas.drawString(pbuf, 278, 14);
    icoBattery(286, 8, lvl < 0 ? 0 : lvl, chg);

    // --- Chips (dados reais recebidos via MQTT) ---
    bool fresh   = (lastDataMs != 0) && (millis() - lastDataMs < DATA_STALE_MS);
    bool hasCo2  = fresh && !isnan(co2Val);
    bool hasTemp = fresh && !isnan(tempVal);
    bool hasHum  = fresh && !isnan(humVal);
    char cbuf[8], tbuf[10], hbuf[8];
    uint16_t co2Col = hasCo2 ? co2Color((int)co2Val) : C_MUTED;
    if (hasCo2)  snprintf(cbuf, sizeof(cbuf), "%d", (int)lroundf(co2Val)); else strcpy(cbuf, "--");
    if (hasTemp) snprintf(tbuf, sizeof(tbuf), "%.1f", (double)tempVal);    else strcpy(tbuf, "--");
    if (hasHum)  snprintf(hbuf, sizeof(hbuf), "%.0f%%", (double)humVal);   else strcpy(hbuf, "--");

    int pad = 14, gap = 8;
    int w = (320 - pad * 2 - gap * 2) / 3;   // 92
    int x0 = pad, x1 = pad + w + gap, x2 = pad + (w + gap) * 2;
    drawChip(x0, w, icoCloud,  co2Col, cbuf, co2Col);
    drawChip(x1, w, icoThermo, C_CRIT, tbuf, hasTemp ? C_TEXT : C_MUTED);
    drawChip(x2, w, icoDrop,   C_DROP, hbuf, hasHum  ? C_TEXT : C_MUTED);

    canvas.pushSprite(0, 0);
}

void setup() {
    auto cfg = M5.config();
    M5.begin(cfg);
    Serial.begin(115200);

    M5.Display.setRotation(1);
    M5.Display.setBrightness(brightnessOn);
    M5.Power.setLed(0);          // desliga o LED de carga do PMU (parava de piscar)
    canvas.setColorDepth(16);
    canvas.createSprite(320, 240);

    // Fita RGB do Bottom2: precisa do 5V do bus ligado p/ alimentar os SK6812
    M5.Power.setExtOutput(true);
    strip.begin();
    strip.setBrightness(LED_BRIGHTNESS);
    strip.clear();
    strip.show();

    buildDeviceIdentity();
    Serial.printf("[BOOT] Device ID: %s (client: %s)\n", deviceId, mqttClientId);

    setenv("TZ", TZ_INFO, 1);   // TZ ja no boot: getLocalTime aplica -3 sobre o RTC (UTC)
    tzset();
    seedClockFromRtc();

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    mqtt.setServer(MQTT_SERVER, MQTT_PORT);
    mqtt.setCallback(mqttCallback);

    M5.Imu.getAccel(&pax, &pay, &paz);   // baseline do acelerometro

    drawUI();
    Serial.println("[SETUP] Core2 Nightstand pronto.");
}

void loop() {
    M5.update();

    auto td = M5.Touch.getDetail();
    if (td.wasClicked()) {
        displayOn = !displayOn;
        autoWake = false;                       // tap manual tem prioridade
        M5.Display.setBrightness(displayOn ? brightnessOn : 0);
        updateLeds();                           // fita acompanha a tela
    }

    // Wake por movimento: com a tela apagada, mexer acende por WAKE_MS.
    float ax, ay, az;
    if (M5.Imu.getAccel(&ax, &ay, &az)) {
        float d = fabsf(ax - pax) + fabsf(ay - pay) + fabsf(az - paz);
        pax = ax; pay = ay; paz = az;
        if (!displayOn && d > MOTION_THRESH) {           // apagada + movimento -> acende
            displayOn = true; autoWake = true;
            wakeUntil = millis() + WAKE_MS;
            M5.Display.setBrightness(brightnessOn);
            updateLeds();                                // fita acende junto
            lastDraw = 0;                                // redesenha ja
        } else if (autoWake && d > MOTION_THRESH) {      // continua mexendo -> renova
            wakeUntil = millis() + WAKE_MS;
        }
    }
    // auto-apaga depois de WAKE_MS parado (so no modo movimento)
    if (autoWake && displayOn && (long)(millis() - wakeUntil) >= 0) {
        displayOn = false; autoWake = false;
        M5.Display.setBrightness(0);
        updateLeds();                                // apaga a fita junto
    }

    bool nowConn = (WiFi.status() == WL_CONNECTED);
    if (nowConn && !wifiConnected) {
        Serial.printf("[WIFI] Conectado: %s\n", WiFi.localIP().toString().c_str());
        wifiConnected = true;
        syncNtp();
    }
    wifiConnected = nowConn;

    handleMqtt();

    if (wifiConnected && (millis() - lastNtpSync >= NTP_SYNC_MS)) syncNtp();

    // breathing da fita: refresh rapido (~30fps) p/ suavidade, so com a tela ligada
    static unsigned long lastLed = 0;
    if (displayOn && millis() - lastLed >= 33) {
        lastLed = millis();
        updateLeds();
    }

    if (displayOn && (millis() - lastDraw >= 1000)) {
        lastDraw = millis();
        drawUI();
    }

    delay(20);
}
