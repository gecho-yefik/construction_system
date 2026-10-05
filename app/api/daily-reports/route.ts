import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/daily-reports - List daily site reports
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const engineerId = searchParams.get("engineerId");

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (engineerId) where.engineerId = engineerId;

    const reports = await prisma.dailyReport.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        project: { select: { id: true, name: true, code: true, location: true } },
        engineer: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return NextResponse.json(reports);
  } catch (error: any) {
    console.error("Daily Reports GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch daily reports" },
      { status: 500 }
    );
  }
}

// POST /api/daily-reports - Create daily site report
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { projectId, date, workSummary, weatherCondition, issues } = body;

    if (!projectId || !workSummary) {
      return NextResponse.json(
        { error: "projectId and workSummary are required" },
        { status: 400 }
      );
    }

    const report = await prisma.dailyReport.create({
      data: {
        projectId,
        engineerId: userId,
        date: date ? new Date(date) : new Date(),
        workSummary: workSummary.trim(),
        weatherCondition: weatherCondition ? weatherCondition.trim() : null,
        issues: issues ? issues.trim() : null,
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        engineer: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error: any) {
    console.error("Daily Reports POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit daily report" },
      { status: 500 }
    );
  }
}
