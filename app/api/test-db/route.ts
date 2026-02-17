import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabase();
    // Test connection by querying the raw_candles table
    const { data, error } = await supabase
      .from("raw_candles")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: `Database error: ${error.message}`,
          hint: error.hint || "Make sure you've run the setup-tables.sql migration in Supabase SQL Editor.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Connected to Supabase successfully.",
      rowCount: data?.length ?? 0,
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
