#include <Arduino.h>
#include <Wire.h>
#include <BH1750.h>
#include <DFRobot_ENS160.h>
#include <SimpleKalmanFilter.h>
#include <SHTSensor.h>
#include <SensirionI2CScd4x.h>
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
#define I2C_RECOVERY_INTERVAL_MS  30000
#define LED_TOGGLE_INTERVAL_MS    500
#define WDT_TIMEOUT_S             30

BH1750 lightMeter;
SHTSensor sht;
DFRobot_ENS160_I2C ENS160(&Wire, 0x53);
SensirionI2CScd4x scd41;

WiFiClient espClient;
PubSubClient client(espClient);

SimpleKalmanFilter kalmanFilterLux(1, 5, 0.01);
SimpleKalmanFilter kalmanFilterECO2(3, 5, 0.01);
SimpleKalmanFilter kalmanFilterTVOC(5, 5, 0.01);
SimpleKalmanFilter kalmanFilterTemp(3, 5, 0.01);
SimpleKalmanFilter kalmanFilterUm(3, 5, 0.01);
SimpleKalmanFilter kalmanFilterScdCO2(3, 5, 0.01);
SimpleKalmanFilter kalmanFilterScdTemp(3, 5, 0.01);
SimpleKalmanFilter kalmanFilterScdUm(3, 5, 0.01);

// Estado dos sensores
bool bh1750_ok = false;
bool ens160_ok = false;
bool sht_ok = false;
bool scd41_ok = false;

// Timers (millis-based, non-blocking)
unsigned long lastSensorRead = 0;
unsigned long lastWiFiStatus = 0;
unsigned long lastMqttRetry = 0;
unsigned long lastI2CRecovery = 0;
unsigned long lastLedToggle = 0;
unsigned long wifiConnectStart = 0;
bool wifiConnecting = false;
bool ledState = false;

// Contadores de falha I2C
uint8_t i2cFailCount = 0;
#define I2C_FAIL_THRESHOLD 10

// LED heartbeat — pisca para indicar que o loop esta rodando
void handleLed(unsigned long now) {
    if (now - lastLedToggle >= LED_TOGGLE_INTERVAL_MS) {
        lastLedToggle = now;
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState);
    }
}

// Tentativa de recuperacao do barramento I2C
void recoverI2C() {
    Serial.println("[I2C] Tentando recuperacao do barramento...");
    Wire.end();

    // Clock out: gera pulsos no SCL para liberar SDA preso em LOW
    pinMode(SDA_PIN, INPUT_PULLUP);
    pinMode(SCL_PIN, OUTPUT);
    for (int i = 0; i < 16; i++) {
        digitalWrite(SCL_PIN, HIGH);
        delayMicroseconds(5);
        digitalWrite(SCL_PIN, LOW);
        delayMicroseconds(5);
    }
    // STOP condition
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

// Re-inicializa todos os sensores
void initSensors() {
    bh1750_ok = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire);
    Serial.printf("[SENSOR] BH1750: %s\n", bh1750_ok ? "OK" : "FALHA");

    ens160_ok = (NO_ERR == ENS160.begin());
    Serial.printf("[SENSOR] ENS160: %s\n", ens160_ok ? "OK" : "FALHA");

    sht_ok = sht.init(Wire);
    Serial.printf("[SENSOR] SHT4x: %s\n", sht_ok ? "OK" : "FALHA");

    // SCD41: parar medicao anterior (caso esteja rodando), depois iniciar
    scd41.begin(Wire);
    scd41.stopPeriodicMeasurement();
    delay(500);
    uint16_t err = scd41.startPeriodicMeasurement();
    scd41_ok = (err == 0);
    Serial.printf("[SENSOR] SCD41: %s\n", scd41_ok ? "OK" : "FALHA");

    i2cFailCount = 0;
}

// Conectar WiFi de forma non-blocking
void startWiFiConnect() {
    Serial.println("[WIFI] Iniciando conexao...");
    WiFi.disconnect();
    WiFi.setHostname("AirQualityNode");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    wifiConnectStart = millis();
    wifiConnecting = true;
}

// Verifica estado da conexao WiFi (non-blocking)
void handleWiFi() {
    if (WiFi.status() == WL_CONNECTED) {
        if (wifiConnecting) {
            Serial.printf("[WIFI] Conectado! IP: %s\n", WiFi.localIP().toString().c_str());
            wifiConnecting = false;
        }
        return;
    }

    // WiFi nao conectado
    if (!wifiConnecting) {
        startWiFiConnect();
        return;
    }

    // Aguardando conexao — verificar timeout
    if (millis() - wifiConnectStart > WIFI_CONNECT_TIMEOUT_MS) {
        Serial.println("[WIFI] Timeout. Tentando novamente...");
        startWiFiConnect();
    }
}

// Reconectar MQTT (tentativa unica, non-blocking)
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

// Publicar dados no MQTT
void publishData(const char* measurement, float value) {
    if (!client.connected()) return;

    char topic[64];
    char payload[50];
    snprintf(topic, sizeof(topic), "teras/iotnode/1/telemetry/%s", measurement);
    snprintf(payload, sizeof(payload), "%.2f", value);

    client.publish(topic, payload);
    Serial.printf("  -> %s: %s\n", measurement, payload);
}

// Ler sensores e publicar
void readAndPublish() {
    bool anyI2CFail = false;

    Serial.println("[READ] Lendo sensores...");

    // BH1750
    if (bh1750_ok) {
        float lux = lightMeter.readLightLevel();
        if (lux >= 0) {
            publishData("bh1750/lux", kalmanFilterLux.updateEstimate(lux));
        } else {
            Serial.println("[SENSOR] BH1750 falhou na leitura.");
            anyI2CFail = true;
        }
    }

    // ENS160
    if (ens160_ok) {
        uint8_t AQI = ENS160.getAQI();
        publishData("ens160/airq", AQI);

        uint16_t TVOC = ENS160.getTVOC();
        if (TVOC > 0) {
            publishData("ens160/tvoc", kalmanFilterTVOC.updateEstimate(TVOC));
        } else {
            anyI2CFail = true;
        }

        uint16_t ECO2 = ENS160.getECO2();
        if (ECO2 > 0) {
            publishData("ens160/eco2", kalmanFilterECO2.updateEstimate(ECO2));
        } else {
            anyI2CFail = true;
        }
    }

    // SHT4x
    if (sht_ok) {
        if (sht.readSample()) {
            publishData("sht4x/temp", kalmanFilterTemp.updateEstimate(sht.getTemperature()));
            publishData("sht4x/umi", kalmanFilterUm.updateEstimate(sht.getHumidity()));
        } else {
            Serial.println("[SENSOR] SHT4x falhou na leitura.");
            anyI2CFail = true;
        }
    }

    // SCD41 — so le quando tem dado pronto (~5s entre medicoes)
    if (scd41_ok) {
        bool dataReady = false;
        uint16_t err = scd41.getDataReadyFlag(dataReady);
        if (err == 0 && dataReady) {
            uint16_t co2Raw = 0;
            float tempScd = 0.0f;
            float humScd = 0.0f;
            err = scd41.readMeasurement(co2Raw, tempScd, humScd);
            if (err == 0 && co2Raw > 0) {
                publishData("scd41/co2", kalmanFilterScdCO2.updateEstimate(co2Raw));
                publishData("scd41/temp", kalmanFilterScdTemp.updateEstimate(tempScd));
                publishData("scd41/umi", kalmanFilterScdUm.updateEstimate(humScd));
            } else {
                Serial.println("[SENSOR] SCD41 falhou na leitura.");
                anyI2CFail = true;
            }
        }
    }

    // Contabilizar falhas I2C consecutivas
    if (anyI2CFail) {
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
    Serial.println("  IoT Air Quality Node v3.0");
    Serial.println("==============================\n");

    // LED heartbeat
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    // Watchdog timer — reseta o device se travar por mais de WDT_TIMEOUT_S segundos
    esp_task_wdt_init(WDT_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);
    Serial.printf("[WDT] Watchdog configurado: %ds\n", WDT_TIMEOUT_S);

    // I2C
    Wire.begin(SDA_PIN, SCL_PIN);

    // Sensores (sem while(true) — falha nao trava o boot)
    initSensors();

    // WiFi (inicia conexao, non-blocking)
    startWiFiConnect();

    // MQTT
    client.setServer(MQTT_SERVER, MQTT_PORT);

    Serial.println("[SETUP] Inicializacao completa.\n");
}

void loop() {
    unsigned long now = millis();

    // Alimentar watchdog — se o loop travar, o WDT reseta o device
    esp_task_wdt_reset();

    // LED heartbeat
    handleLed(now);

    // WiFi (non-blocking)
    handleWiFi();

    // MQTT (non-blocking, tentativa unica por ciclo)
    handleMQTT();

    // Leitura de sensores a cada SENSOR_READ_INTERVAL_MS
    if (now - lastSensorRead >= SENSOR_READ_INTERVAL_MS) {
        lastSensorRead = now;
        readAndPublish();
    }

    // Recuperacao I2C se muitas falhas consecutivas
    if (i2cFailCount >= I2C_FAIL_THRESHOLD) {
        Serial.println("[I2C] Muitas falhas consecutivas — recuperando...");
        recoverI2C();
        initSensors();
    }

    // Status periodico
    if (now - lastWiFiStatus >= WIFI_STATUS_INTERVAL_MS) {
        lastWiFiStatus = now;
        Serial.printf("[STATUS] WiFi=%s | MQTT=%s | Sensores: BH=%d ENS=%d SHT=%d SCD=%d | Heap=%u bytes | Uptime=%lus\n",
            WiFi.status() == WL_CONNECTED ? "OK" : "DESCONECTADO",
            client.connected() ? "OK" : "DESCONECTADO",
            bh1750_ok, ens160_ok, sht_ok, scd41_ok,
            ESP.getFreeHeap(),
            millis() / 1000);
    }
}
