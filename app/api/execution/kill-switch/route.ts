import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  activateKillSwitch,
  deactivateKillSwitch,
} from "@/lib/execution/kill-switch";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    active: boolean;
    reason?: string;
  };

  if (body.active) {
    const result = await activateKillSwitch(
      prisma,
      body.reason ?? "Manual activation via dashboard",
    );
    return NextResponse.json({ success: true, ...result });
  }

  await deactivateKillSwitch(prisma);
  return NextResponse.json({ success: true });
}
