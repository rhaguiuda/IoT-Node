import mqtt from "mqtt";
import { insertReading, purgeOldReadings } from "./db";
import { checkCo2Alert, checkOfflineAlert, updateLastMessageTime } from "./alerts";

const MQTT_URL = process.env.MQTT_URL || "mqtt://192.168.100.224:1883";
const TOPIC = "teras/iotnode/1/telemetry/#";
const VALID_MEASUREMENTS = new Set(["co2", "temp", "umi"]);

console.log("[COLLECTOR] Starting...");
console.log(`[COLLECTOR] Connecting to ${MQTT_URL}`);

const client = mqtt.connect(MQTT_URL);

client.on("connect", () => {
  console.log("[COLLECTOR] Connected to MQTT broker");
  client.subscribe(TOPIC, (err) => {
    if (err) console.error("[COLLECTOR] Subscribe error:", err);
    else console.log(`[COLLECTOR] Subscribed to ${TOPIC}`);
  });
});

client.on("message", async (topic, payload) => {
  // topic: teras/iotnode/1/telemetry/<measurement>
  const measurement = topic.split("/").pop();
  if (!measurement || !VALID_MEASUREMENTS.has(measurement)) return;
  const value = parseFloat(payload.toString());
  if (isNaN(value)) return;
  const timestamp = Math.floor(Date.now() / 1000);
  insertReading(measurement, value, timestamp);
  updateLastMessageTime();
  if (measurement === "co2") {
    await checkCo2Alert(value);
  }
});

client.on("error", (err) => console.error("[COLLECTOR] MQTT error:", err));
client.on("reconnect", () => console.log("[COLLECTOR] Reconnecting..."));

setInterval(() => checkOfflineAlert(), 60000);
setInterval(() => purgeOldReadings(), 86400000);
purgeOldReadings();

console.log("[COLLECTOR] Running. Waiting for MQTT messages...");
