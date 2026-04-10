import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, updateSettings } from "@/lib/db";

export async function GET() {
  const settings = getAllSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }
  const updates: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) updates[k] = String(v);
  updateSettings(updates);
  return NextResponse.json({ ok: true });
}
