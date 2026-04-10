import { NextRequest, NextResponse } from "next/server";
import { queryReadings } from "@/lib/db";
import { RANGES } from "@/config/ranges";
import type { RangeId } from "@/lib/types";

const SENSOR_MEASUREMENTS: Record<string, string[]> = {
  scd41: ["co2", "temp", "umi"],
  ens160: ["eco2", "tvoc", "airq"],
  sht4x: ["temp", "umi"],
  bh1750: ["lux"],
};

export async function GET(request: NextRequest) {
  const rangeId = (request.nextUrl.searchParams.get("range") || "1h") as RangeId;
  const rangeConfig = RANGES.find((r) => r.id === rangeId);
  if (!rangeConfig) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  const fromTimestamp = Math.floor(Date.now() / 1000) - rangeConfig.seconds;
  const result: Record<string, Record<string, { timestamp: number; value: number }[]>> = {};
  for (const [sensor, measurements] of Object.entries(SENSOR_MEASUREMENTS)) {
    result[sensor] = {};
    for (const measurement of measurements) {
      result[sensor][measurement] = queryReadings(sensor, measurement, fromTimestamp, rangeConfig.downsampleSec);
    }
  }
  return NextResponse.json(result);
}
