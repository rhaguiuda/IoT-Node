import { NextRequest, NextResponse } from "next/server";
import { queryReadings } from "@/lib/db";
import { RANGES } from "@/config/ranges";
import type { RangeId } from "@/lib/types";

const MEASUREMENTS = ["co2", "temp", "umi"];

export async function GET(request: NextRequest) {
  const rangeId = (request.nextUrl.searchParams.get("range") || "1h") as RangeId;
  const rangeConfig = RANGES.find((r) => r.id === rangeId);
  if (!rangeConfig) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  const fromTimestamp = Math.floor(Date.now() / 1000) - rangeConfig.seconds;
  const result: Record<string, { timestamp: number; value: number }[]> = {};
  for (const measurement of MEASUREMENTS) {
    result[measurement] = queryReadings(measurement, fromTimestamp, rangeConfig.downsampleSec);
  }
  return NextResponse.json(result);
}
