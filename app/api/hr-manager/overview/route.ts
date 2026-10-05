import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalWorkers,
      activeWorkers,
      projects,
      todayAttendances,
      workersList,
      tradesBreakdown,
    ] = await Promise.all([
      prisma.worker.count(),
      prisma.worker.count({ where: { isActive: true } }),
      prisma.project.findMany({
        where: { status: { in: ["IN_PROGRESS", "PLANNED"] } },
        select: {
          id: true,
          name: true,
          code: true,
          _count: { select: { workforce: true } },
        },
      }),
      prisma.attendance.findMany({
        where: {
          date: { gte: today },
        },
        include: {
          worker: { select: { id: true, fullName: true, trade: true, dailyWage: true } },
          project: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.worker.findMany({
        orderBy: { fullName: "asc" },
        include: {
          assignments: {
            include: {
              project: { select: { id: true, name: true, code: true } },
            },
          },
          _count: { select: { attendances: true } },
        },
      }),
      prisma.worker.groupBy({
        by: ["trade"],
        _count: { id: true },
      }),
    ]);

    const presentToday = todayAttendances.filter((a) => a.status === "PRESENT").length;
    const absentToday = todayAttendances.filter((a) => a.status === "ABSENT").length;
    const todayLaborCost = todayAttendances
      .filter((a) => a.status === "PRESENT")
      .reduce((sum, a) => sum + (a.worker?.dailyWage || 0) * ((a.hoursWorked || 8) / 8), 0);

    return NextResponse.json({
      metrics: {
        totalWorkers,
        activeWorkers,
        presentToday,
        absentToday,
        activeProjectsCount: projects.length,
        todayLaborCost: Math.round(todayLaborCost),
      },
      trades: tradesBreakdown.map((t) => ({ trade: t.trade, count: t._count.id })),
      projects,
      workers: workersList,
      todayAttendances,
    });
  } catch (error: any) {
    console.error("HR overview error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load HR overview" },
      { status: 500 }
    );
  }
}
