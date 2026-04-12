#include <Arduino.h>
#include <Wire.h>
#include <SensirionI2CScd4x.h>
#include <SimpleKalmanFilter.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <esp_task_wdt.h>
#include <Preferences.h>
#include <esp_system.h>

// Configuracao da rede Wi-Fi
#define WIFI_SSID "NHag"
#define WIFI_PASSWORD ".!navio@"

// Configuracao do servidor MQTT
#define MQTT_SERVER "192.168.100.224"
#define MQTT_PORT 1883

// Definindo pinos I2C para o ESP32-C3-DevKitM-1
// GPIO8 is RGB LED, GPIO9 is boot strapping — avoid both for I2C
#define SDA_PIN 4
#define SCL_PIN 6

// LED RGB (WS2812) on GPIO8
#define LED_RGB_PIN 8

// Timeouts e intervalos
#define WIFI_CONNECT_TIMEOUT_MS   15000
#define MQTT_RETRY_INTERVAL_MS    5000
#define SENSOR_READ_INTERVAL_MS   5000   // SCD41 updates every ~5s, no point polling faster
#define WIFI_STATUS_INTERVAL_MS   10000
#define LED_TOGGLE_INTERVAL_MS    500
#define UPTIME_SAVE_INTERVAL_MS   60000
#define WDT_TIMEOUT_S             15     // Tighter watchdog (was 30s)
#define I2C_TIMEOUT_MS            1000   // I2C transaction timeout
#define AUTO_RESTART_HOURS        24     // Preventive restart every 24h

SensirionI2CScd4x scd41;

WiFiClient espClient;
PubSubClient client(espClient);

SimpleKalmanFilter kalmanCO2(3, 5, 0.5);
SimpleKalmanFilter kalmanTemp(3, 5, 0.5);
SimpleKalmanFilter kalmanUmi(3, 5, 0.5);

bool scd41_ok = false;

// Timers (millis-based, non-blocking)
unsigned long lastSensorRead = 0;
unsigned long lastWiFiStatus = 0;
unsigned long lastMqttRetry = 0;
unsigned long lastLedToggle = 0;
unsigned long lastUptimeSave = 0;
unsigned long wifiConnectStart = 0;
bool wifiConnecting = false;
bool ledState = false;

uint8_t i2cFailCount = 0;
const char* lastResetReason = "UNKNOWN";
#define I2C_FAIL_THRESHOLD 5   // Faster recovery (was 10)

void handleLed(unsigned long now) {
    if (now - lastLedToggle >= LED_TOGGLE_INTERVAL_MS) {
        lastLedToggle = now;
        ledState = !ledState;
        // WS2812 RGB LED: dim teal when on, off when off
        if (ledState) {
            neopixelWrite(LED_RGB_PIN, 0, 10, 8); // dim teal (R=0, G=10, B=8)
        } else {
            neopixelWrite(LED_RGB_PIN, 0, 0, 0);
        }
    }
}

void recoverI2C() {
    Serial.println("[I2C] Recuperando barramento...");
    Wire.end();
    pinMode(SDA_PIN, INPUT_PULLUP);
    pinMode(SCL_PIN, OUTPUT);
    for (int i = 0; i < 16; i++) {
        digitalWrite(SCL_PIN, HIGH);
        delayMicroseconds(5);
        digitalWrite(SCL_PIN, LOW);
        delayMicroseconds(5);
    }
    pinMode(SDA_PIN, OUTPUT);
    digitalWrite(SDA_PIN, LOW);
    delayMicroseconds(5);
    digitalWrite(SCL_PIN, HIGH);
    delayMicroseconds(5);
    digitalWrite(SDA_PIN, HIGH);
    delayMicroseconds(5);
    Wire.begin(SDA_PIN, SCL_PIN);
    Wire.setTimeout(I2C_TIMEOUT_MS);
    Serial.println("[I2C] Barramento reiniciado.");
}

void initSensor() {
    scd41.begin(Wire);
    scd41.stopPeriodicMeasurement();
    delay(500);
    uint16_t err = scd41.startPeriodicMeasurement();
    scd41_ok = (err == 0);
    Serial.printf("[SENSOR] SCD41: %s\n", scd41_ok ? "OK" : "FALHA");
    i2cFailCount = 0;
}

void startWiFiConnect() {
    Serial.println("[WIFI] Iniciando conexao...");
    WiFi.disconnect();
    WiFi.setHostname("AirQualityNode");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    wifiConnectStart = millis();
    wifiConnecting = true;
}

void handleWiFi() {
    if (WiFi.status() == WL_CONNECTED) {
        if (wifiConnecting) {
            Serial.printf("[WIFI] Conectado! IP: %s\n", WiFi.localIP().toString().c_str());
            wifiConnecting = false;
        }
        return;
    }
    if (!wifiConnecting) {
        startWiFiConnect();
        return;
    }
    if (millis() - wifiConnectStart > WIFI_CONNECT_TIMEOUT_MS) {
        Serial.println("[WIFI] Timeout. Tentando novamente...");
        startWiFiConnect();
    }
}

void handleMQTT() {
    if (WiFi.status() != WL_CONNECTED) return;
    if (client.connected()) {
        client.loop();
        return;
    }
    if (millis() - lastMqttRetry < MQTT_RETRY_INTERVAL_MS) return;
    lastMqttRetry = millis();
    Serial.print("[MQTT] Conectando...");
    if (client.connect("AirQualityNode")) {
        Serial.println(" OK!");
    } else {
        Serial.printf(" falhou (rc=%d)\n", client.state());
    }
}

void publishData(const char* measurement, float value) {
    if (!client.connected()) return;
    char topic[64];
    char payload[50];
    snprintf(topic, sizeof(topic), "teras/iotnode/1/telemetry/%s", measurement);
    snprintf(payload, sizeof(payload), "%.2f", value);
    client.publish(topic, payload);
    Serial.printf("  -> %s: %s\n", measurement, payload);
}

void readAndPublish() {
    bool i2cFail = false;

    if (scd41_ok) {
        bool dataReady = false;
        uint16_t err = scd41.getDataReadyFlag(dataReady);
        if (err == 0 && dataReady) {
            uint16_t co2Raw = 0;
            float temp = 0.0f;
            float hum = 0.0f;
            err = scd41.readMeasurement(co2Raw, temp, hum);
            if (err == 0 && co2Raw > 0) {
                publishData("co2", kalmanCO2.updateEstimate(co2Raw));
                publishData("temp", kalmanTemp.updateEstimate(temp));
                publishData("umi", kalmanUmi.updateEstimate(hum));
            } else {
                Serial.println("[SENSOR] SCD41 falhou na leitura.");
                i2cFail = true;
            }
        }
    }

    if (i2cFail) {
        i2cFailCount++;
        Serial.printf("[I2C] Falhas consecutivas: %d/%d\n", i2cFailCount, I2C_FAIL_THRESHOLD);
    } else {
        i2cFailCount = 0;
    }
}

const char* getResetReasonStr(esp_reset_reason_t reason) {
    switch (reason) {
        case ESP_RST_POWERON:  return "POWER_ON";
        case ESP_RST_EXT:      return "EXTERNAL";
        case ESP_RST_SW:       return "SOFTWARE";
        case ESP_RST_PANIC:    return "PANIC/CRASH";
        case ESP_RST_INT_WDT:  return "INTERRUPT_WDT";
        case ESP_RST_TASK_WDT: return "TASK_WDT";
        case ESP_RST_WDT:      return "OTHER_WDT";
        case ESP_RST_DEEPSLEEP: return "DEEP_SLEEP";
        case ESP_RST_BROWNOUT: return "BROWNOUT";
        case ESP_RST_SDIO:     return "SDIO";
        default:               return "UNKNOWN";
    }
}

void setup() {
    Serial.begin(115200);
    delay(500);

    // Boot diagnostics
    esp_reset_reason_t resetReason = esp_reset_reason();
    lastResetReason = getResetReasonStr(resetReason);
    Preferences prefs;
    prefs.begin("diag", false);
    uint32_t bootCount = prefs.getUInt("boots", 0) + 1;
    prefs.putUInt("boots", bootCount);

    uint32_t lastUptime = prefs.getUInt("uptime", 0);

    uint32_t wdtCount = prefs.getUInt("wdt", 0);
    uint32_t brownoutCount = prefs.getUInt("brownout", 0);
    uint32_t panicCount = prefs.getUInt("panic", 0);

    if (resetReason == ESP_RST_TASK_WDT || resetReason == ESP_RST_INT_WDT || resetReason == ESP_RST_WDT) {
        wdtCount++;
        prefs.putUInt("wdt", wdtCount);
    } else if (resetReason == ESP_RST_BROWNOUT) {
        brownoutCount++;
        prefs.putUInt("brownout", brownoutCount);
    } else if (resetReason == ESP_RST_PANIC) {
        panicCount++;
        prefs.putUInt("panic", panicCount);
    }
    prefs.end();

    Serial.println("\n==============================");
    Serial.println("  IoT Air Quality Node v5.0");
    Serial.println("==============================");
    Serial.printf("[BOOT] Count: %u\n", bootCount);
    Serial.printf("[BOOT] Reset reason: %s (%d)\n", getResetReasonStr(resetReason), resetReason);
    Serial.printf("[BOOT] Last uptime before reset: %us (%uh %um)\n", lastUptime, lastUptime / 3600, (lastUptime % 3600) / 60);
    Serial.printf("[BOOT] History — WDT: %u | Brownout: %u | Panic: %u\n\n", wdtCount, brownoutCount, panicCount);

    // LED heartbeat (RGB WS2812 on GPIO8)
    neopixelWrite(LED_RGB_PIN, 0, 0, 0);

    // Watchdog — tighter at 15s
    esp_task_wdt_init(WDT_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);
    Serial.printf("[WDT] Watchdog: %ds\n", WDT_TIMEOUT_S);

    // I2C with timeout and internal pull-ups
    pinMode(SDA_PIN, INPUT_PULLUP);
    pinMode(SCL_PIN, INPUT_PULLUP);
    Wire.begin(SDA_PIN, SCL_PIN);
    Wire.setTimeout(I2C_TIMEOUT_MS);
    Serial.printf("[I2C] Timeout: %dms, SDA=%d, SCL=%d\n", I2C_TIMEOUT_MS, SDA_PIN, SCL_PIN);

    initSensor();
    startWiFiConnect();
    client.setServer(MQTT_SERVER, MQTT_PORT);

    Serial.printf("[AUTO] Restart preventivo a cada %dh\n", AUTO_RESTART_HOURS);
    Serial.println("[SETUP] Inicializacao completa.\n");
}

void loop() {
    unsigned long now = millis();

    // Feed watchdog
    esp_task_wdt_reset();

    // LED heartbeat
    handleLed(now);

    // WiFi (non-blocking)
    handleWiFi();

    // MQTT (non-blocking)
    handleMQTT();

    // Sensor read every 5s (matches SCD41 measurement cycle)
    if (now - lastSensorRead >= SENSOR_READ_INTERVAL_MS) {
        lastSensorRead = now;
        readAndPublish();
    }

    // I2C recovery
    if (i2cFailCount >= I2C_FAIL_THRESHOLD) {
        Serial.println("[I2C] Muitas falhas — recuperando...");
        recoverI2C();
        initSensor();
    }

    // Save uptime to NVS every minute
    if (now - lastUptimeSave >= UPTIME_SAVE_INTERVAL_MS) {
        lastUptimeSave = now;
        Preferences prefs;
        prefs.begin("diag", false);
        prefs.putUInt("uptime", now / 1000);
        prefs.end();
    }

    // Preventive auto-restart every 24h
    if (now / 1000 >= AUTO_RESTART_HOURS * 3600UL) {
        Serial.println("[AUTO] Restart preventivo — 24h de uptime atingido.");
        Preferences prefs;
        prefs.begin("diag", false);
        prefs.putUInt("uptime", now / 1000);
        prefs.end();
        delay(100);
        ESP.restart();
    }

    // Status line
    if (now - lastWiFiStatus >= WIFI_STATUS_INTERVAL_MS) {
        lastWiFiStatus = now;
        Serial.printf("[STATUS] WiFi=%s | MQTT=%s | SCD41=%d | Heap=%u | Uptime=%lus | LastReset=%s\n",
            WiFi.status() == WL_CONNECTED ? "OK" : "DESCONECTADO",
            client.connected() ? "OK" : "DESCONECTADO",
            scd41_ok,
            ESP.getFreeHeap(),
            millis() / 1000,
            lastResetReason);
    }
}
