import { NextResponse } from "next/server";
import { testConnection } from "@/lib/twelvedata";

export async function GET() {
  const result = await testConnection();

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  });
}
