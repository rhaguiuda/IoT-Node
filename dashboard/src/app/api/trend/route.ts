import { NextRequest, NextResponse } from "next/server";
import { queryTrend } from "@/lib/db";

export async function GET(request: NextRequest) {
  const device = request.nextUrl.searchParams.get("device");
  if (!device) {
    return NextResponse.json({ error: "Missing device" }, { status: 400 });
  }
  return NextResponse.json({
    co2: queryTrend(device, "co2"),
    temp: queryTrend(device, "temp"),
    umi: queryTrend(device, "umi"),
  });
}
