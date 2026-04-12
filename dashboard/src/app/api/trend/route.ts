import { NextResponse } from "next/server";
import { queryTrend } from "@/lib/db";

export async function GET() {
  return NextResponse.json({
    co2: queryTrend("co2"),
    temp: queryTrend("temp"),
    umi: queryTrend("umi"),
  });
}
