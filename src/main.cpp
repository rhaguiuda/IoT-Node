#include <Arduino.h>
#include <Wire.h>
#include <BH1750.h>
#include <DFRobot_ENS160.h>
#include <SimpleKalmanFilter.h>
#include <SHTSensor.h>
#include <WiFi.h>
#include <PubSubClient.h>

// Configuração da rede Wi-Fi
#define WIFI_SSID "NHag"
#define WIFI_PASSWORD ".!navio@"

// Configuração do servidor MQTT
#define MQTT_SERVER "192.168.100.224"  // Endereço do servidor MQTT
#define MQTT_PORT 1883                  // Porta do servidor MQTT

// Definindo pinos I2C para o LOLIN S2 Mini
#define SDA_PIN 37
#define SCL_PIN 39

BH1750 lightMeter;
SHTSensor sht;
DFRobot_ENS160_I2C ENS160(&Wire, /*I2CAddr*/ 0x53);   // Instância para o sensor ENS160

WiFiClient espClient;
PubSubClient client(espClient);

SimpleKalmanFilter kalmanFilterLux(1, 5, 0.01);
SimpleKalmanFilter kalmanFilterECO2(3, 5, 0.01);
SimpleKalmanFilter kalmanFilterTVOC(5, 5, 0.01);
SimpleKalmanFilter kalmanFilterTemp(3, 5, 0.01);
SimpleKalmanFilter kalmanFilterUm(3, 5, 0.01);

// Função para conectar no Wi-Fi
void setupWiFi() {
	delay(10);
	Serial.println();
	Serial.print("Conectando-se a ");
	Serial.println(WIFI_SSID);

 	// Configurar o hostname antes de conectar
    WiFi.setHostname("AirQualityNode");

	WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

	while (WiFi.status() != WL_CONNECTED) {
		delay(500);
		Serial.print(".");
	}
	Serial.println();
	Serial.println("Wi-Fi conectado!");
	Serial.print("Endereço IP: ");
	Serial.println(WiFi.localIP());
}

// Função para imprimir o status do Wi-Fi
void printWiFiStatus() {
    Serial.println("----- Status Wi-Fi -----");
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("Status: Conectado");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
        Serial.print("MAC: ");
        Serial.println(WiFi.macAddress());
    } else {
        Serial.println("Status: Não conectado");
    }
    Serial.println("------------------------");
}

// Função para conectar ao servidor MQTT
void reconnectMQTT() {
	while (!client.connected()) {
		Serial.print("Conectando ao MQTT...");
		if (client.connect("AirQualityNode")) {
			Serial.println("conectado!");
		} else {
			Serial.print("falhou, rc=");
			Serial.print(client.state());
			Serial.println(" tentando novamente em 5 segundos");
			delay(5000);
		}
	}
}

// Função para publicar dados no MQTT
void publishData(const char* measurement, float value) {
	char topic[50];
	char payload[50];
	
	snprintf(topic, sizeof(topic), "teras/iotnode/1/telemetry/%s", measurement);
	snprintf(payload, sizeof(payload), "%.2f", value);
	
	client.publish(topic, payload);
	Serial.print("Publicado em ");
	Serial.print(topic);
	Serial.print(": ");
	Serial.println(payload);
}

void setup() {
		Serial.begin(115200);
		// Configura o I2C com os pinos especificados
		Wire.begin(SDA_PIN, SCL_PIN);

		// Inicia o sensor BH1750
		if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire)) {
				Serial.println(F("Erro ao iniciar o BH1750. Verifique as conexões."));
				while (true);
		}

		Serial.println(F("Sensor BH1750 inicializado com sucesso."));

	// Init the sensor
	while(NO_ERR != ENS160.begin())
	{
		Serial.println("Communication with device failed, please check connection");
		delay(3000);
	}
	Serial.println("Begin ok!");

	if (sht.init(Wire))
	{
		Serial.print("init(): success\n");
  	}
	else
	{
		Serial.print("init(): failed\n");
	}

	// Conectar ao Wi-Fi
	setupWiFi();

	// Configuração do servidor MQTT
	client.setServer(MQTT_SERVER, MQTT_PORT);

	printWiFiStatus();
}

void loop()
{
	// Verificar se o Wi-Fi está desconectado e tentar reconectar
    if (WiFi.status() != WL_CONNECTED)
	{
        Serial.println("Wi-Fi desconectado. Tentando reconectar...");
        setupWiFi();
    }

	if (!client.connected())
	{
        reconnectMQTT();
    }
    client.loop();

	float lux = lightMeter.readLightLevel();
	if (lux > 0)
	{
		float filteredLux = kalmanFilterLux.updateEstimate(lux);
        publishData("lux", filteredLux);
	}
	else
	{
		Serial.println("Erro ao ler o BH1750.");
	}

	/**
	 * Get the air quality index
	 * Return value: 1-Excellent, 2-Good, 3-Moderate, 4-Poor, 5-Unhealthy
	 */
	uint8_t AQI = ENS160.getAQI();
	publishData("airq", AQI);

	/**
	 * Get TVOC concentration
	 * Return value range: 0-65000, unit: ppb
	 */
	uint16_t TVOC = ENS160.getTVOC();
	if (TVOC > 0)
	{
        float filteredTVOC = kalmanFilterTVOC.updateEstimate(TVOC);
        publishData("tvoc", filteredTVOC);
    }
	else
	{
        Serial.println("Erro ao ler o TVOC.");
    }

	/**
	 * Get CO2 equivalent concentration calculated according to the detected data of VOCs and hydrogen (eCO2 - Equivalent CO2)
	 * Return value range: 400-65000, unit: ppm
	 * Five levels: Excellent(400 - 600), Good(600 - 800), Moderate(800 - 1000), 
	 *               Poor(1000 - 1500), Unhealthy(> 1500)
	 */
	uint16_t ECO2 = ENS160.getECO2();
	if (ECO2 > 0)
	{
        float filteredECO2 = kalmanFilterECO2.updateEstimate(ECO2);
        publishData("eco2", filteredECO2);
    }
	else
	{
        Serial.println("Erro ao ler o ECO2.");
    }

	if(sht.readSample())
	{
		float temp = sht.getTemperature();
		float filteredTemp = kalmanFilterTemp.updateEstimate(temp);
        publishData("temp", filteredTemp);

		float hm = sht.getHumidity();
		float filteredHm = kalmanFilterUm.updateEstimate(hm);
		publishData("umi", filteredHm);
	}
	else
	{
		Serial.println("Error reading SHT4X.");
	}

	// Aguarda um segundo antes da próxima leitura
	delay(1000);

	// Exibir status Wi-Fi a cada 10 loops
    static int counter = 0;
    if (counter++ % 10 == 0)
	{
        printWiFiStatus();
    }
}
