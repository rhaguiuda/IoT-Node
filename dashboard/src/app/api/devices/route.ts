import { NextRequest, NextResponse } from "next/server";
import { listDevices, updateDeviceName } from "@/lib/db";

export async function GET() {
  return NextResponse.json(listDevices());
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const deviceId = typeof body?.device_id === "string" ? body.device_id.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!deviceId) {
    return NextResponse.json({ error: "device_id is required" }, { status: 400 });
  }
  // Empty name resets the device to "unnamed" (name = device_id), so the UI
  // shows the MAC again instead of a custom name.
  updateDeviceName(deviceId, name || deviceId);
  return NextResponse.json({ ok: true });
}
