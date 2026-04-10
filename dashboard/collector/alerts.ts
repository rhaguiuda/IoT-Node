import { getSetting } from "./db";

let lastCo2Alert = 0;
let lastOfflineAlert = 0;
let lastMessageTime = Date.now();

export function updateLastMessageTime(): void {
  lastMessageTime = Date.now();
}

export function getLastMessageTime(): number {
  return lastMessageTime;
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

export async function checkCo2Alert(value: number): Promise<void> {
  if (getSetting("alerts_enabled") !== "true") return;
  const threshold = parseInt(getSetting("co2_threshold") || "1000", 10);
  const cooldown = parseInt(getSetting("alert_cooldown") || "15", 10) * 60 * 1000;
  const now = Date.now();
  if (value > threshold && now - lastCo2Alert > cooldown) {
    lastCo2Alert = now;
    await sendPushover(`CO\u2082 at ${Math.round(value)} ppm (threshold: ${threshold})`, 0);
  }
}

export async function checkOfflineAlert(): Promise<void> {
  if (getSetting("alerts_enabled") !== "true") return;
  const timeout = parseInt(getSetting("offline_timeout") || "5", 10) * 60 * 1000;
  const now = Date.now();
  const elapsed = now - lastMessageTime;
  if (elapsed > timeout && now - lastOfflineAlert > 30 * 60 * 1000) {
    lastOfflineAlert = now;
    const minutes = Math.round(elapsed / 60000);
    await sendPushover(`Air Quality Node offline for ${minutes} minutes`, 1);
  }
}
