import { NextRequest, NextResponse } from "next/server";
import { listDevices, updateDeviceName } from "@/lib/db";

export async function GET() {
  return NextResponse.json(listDevices());
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const deviceId = typeof body?.device_id === "string" ? body.device_id.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!deviceId || !name) {
    return NextResponse.json({ error: "device_id and name are required" }, { status: 400 });
  }
  updateDeviceName(deviceId, name);
  return NextResponse.json({ ok: true });
}
