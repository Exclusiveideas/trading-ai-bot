import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.rawCandle.count();

    return NextResponse.json({
      success: true,
      message: `Connected to Supabase via Prisma. ${count} candles in database.`,
      rowCount: count,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
