import { getSetting, getDeviceName } from "./db";

// Alert state is tracked per device so one node's CO2 spike or outage does not
// suppress alerts for another. Keys are device ids.
const lastCo2Alert = new Map<string, number>();
const lastOfflineAlert = new Map<string, number>();
const lastMessageTime = new Map<string, number>();

export function updateLastMessageTime(deviceId: string): void {
  lastMessageTime.set(deviceId, Date.now());
}

async function sendPushover(message: string, priority: number): Promise<void> {
  const userKey = getSetting("pushover_user_key");
  const apiToken = getSetting("pushover_api_token");
  if (!userKey || !apiToken) return;

  try {
    const res = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: apiToken,
        user: userKey,
        message,
        title: "Air Quality Node",
        priority,
      }),
    });
    if (!res.ok) {
      console.error(`[PUSHOVER] Failed: ${res.status} ${await res.text()}`);
    } else {
      console.log(`[PUSHOVER] Sent: ${message}`);
    }
  } catch (err) {
    console.error("[PUSHOVER] Error:", err);
  }
}

export async function checkCo2Alert(deviceId: string, value: number): Promise<void> {
  if (getSetting("alerts_enabled") !== "true") return;
  const threshold = parseInt(getSetting("co2_threshold") || "1000", 10);
  const cooldown = parseInt(getSetting("alert_cooldown") || "15", 10) * 60 * 1000;
  const now = Date.now();
  if (value > threshold && now - (lastCo2Alert.get(deviceId) ?? 0) > cooldown) {
    lastCo2Alert.set(deviceId, now);
    await sendPushover(
      `${getDeviceName(deviceId)}: CO₂ at ${Math.round(value)} ppm (threshold: ${threshold})`,
      0,
    );
  }
}

// Checks every device that has reported at least once this process lifetime.
export async function checkOfflineAlert(): Promise<void> {
  if (getSetting("alerts_enabled") !== "true") return;
  const timeout = parseInt(getSetting("offline_timeout") || "5", 10) * 60 * 1000;
  const now = Date.now();
  for (const [deviceId, lastSeen] of lastMessageTime) {
    const elapsed = now - lastSeen;
    if (elapsed > timeout && now - (lastOfflineAlert.get(deviceId) ?? 0) > 30 * 60 * 1000) {
      lastOfflineAlert.set(deviceId, now);
      const minutes = Math.round(elapsed / 60000);
      await sendPushover(`${getDeviceName(deviceId)} offline for ${minutes} minutes`, 1);
    }
  }
}
