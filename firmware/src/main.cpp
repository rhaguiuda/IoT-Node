#include <Arduino.h>
#include <Wire.h>
#include <SensirionI2CScd4x.h>
#include <SimpleKalmanFilter.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <esp_task_wdt.h>

// Configuracao da rede Wi-Fi
#define WIFI_SSID "NHag"
#define WIFI_PASSWORD ".!navio@"

// Configuracao do servidor MQTT
#define MQTT_SERVER "192.168.100.224"
#define MQTT_PORT 1883

// Definindo pinos I2C para o LOLIN S2 Mini
#define SDA_PIN 37
#define SCL_PIN 39

// LED built-in
#define LED_PIN 15

// Timeouts e intervalos
#define WIFI_CONNECT_TIMEOUT_MS   15000
#define MQTT_RETRY_INTERVAL_MS    5000
#define SENSOR_READ_INTERVAL_MS   1000
#define WIFI_STATUS_INTERVAL_MS   10000
#define LED_TOGGLE_INTERVAL_MS    500
#define WDT_TIMEOUT_S             30

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
unsigned long wifiConnectStart = 0;
bool wifiConnecting = false;
bool ledState = false;

uint8_t i2cFailCount = 0;
#define I2C_FAIL_THRESHOLD 10

void handleLed(unsigned long now) {
    if (now - lastLedToggle >= LED_TOGGLE_INTERVAL_MS) {
        lastLedToggle = now;
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState);
    }
}

void recoverI2C() {
    Serial.println("[I2C] Tentando recuperacao do barramento...");
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

    Serial.println("[READ] Lendo SCD41...");

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

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n==============================");
    Serial.println("  IoT Air Quality Node v4.0");
    Serial.println("==============================\n");

    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    esp_task_wdt_init(WDT_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);
    Serial.printf("[WDT] Watchdog configurado: %ds\n", WDT_TIMEOUT_S);

    Wire.begin(SDA_PIN, SCL_PIN);
    initSensor();
    startWiFiConnect();
    client.setServer(MQTT_SERVER, MQTT_PORT);

    Serial.println("[SETUP] Inicializacao completa.\n");
}

void loop() {
    unsigned long now = millis();

    esp_task_wdt_reset();
    handleLed(now);
    handleWiFi();
    handleMQTT();

    if (now - lastSensorRead >= SENSOR_READ_INTERVAL_MS) {
        lastSensorRead = now;
        readAndPublish();
    }

    if (i2cFailCount >= I2C_FAIL_THRESHOLD) {
        Serial.println("[I2C] Muitas falhas consecutivas — recuperando...");
        recoverI2C();
        initSensor();
    }

    if (now - lastWiFiStatus >= WIFI_STATUS_INTERVAL_MS) {
        lastWiFiStatus = now;
        Serial.printf("[STATUS] WiFi=%s | MQTT=%s | SCD41=%d | Heap=%u bytes | Uptime=%lus\n",
            WiFi.status() == WL_CONNECTED ? "OK" : "DESCONECTADO",
            client.connected() ? "OK" : "DESCONECTADO",
            scd41_ok,
            ESP.getFreeHeap(),
            millis() / 1000);
    }
}
