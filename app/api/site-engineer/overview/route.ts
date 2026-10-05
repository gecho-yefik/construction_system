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

    const userId = session.user.id;

    // Fetch projects, daily reports by this engineer, active tasks, material catalog, and worker roster
    const [projects, myReports, recentTasks, materials, workers, myRequests] =
      await Promise.all([
        prisma.project.findMany({
          where: { status: "IN_PROGRESS" },
          select: {
            id: true,
            name: true,
            code: true,
            location: true,
            workforce: {
              include: {
                worker: { select: { id: true, fullName: true, trade: true, dailyWage: true } },
              },
            },
            tasks: {
              where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
              select: { id: true, name: true, status: true, dueDate: true },
            },
          },
        }),
        prisma.dailyReport.findMany({
          where: { engineerId: userId },
          orderBy: { date: "desc" },
          take: 15,
          include: {
            project: { select: { id: true, name: true, code: true } },
          },
        }),
        prisma.task.findMany({
          where: { status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
          orderBy: { dueDate: "asc" },
          take: 10,
          include: {
            project: { select: { id: true, name: true, code: true } },
          },
        }),
        prisma.material.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, unit: true, quantity: true },
        }),
        prisma.worker.findMany({
          where: { isActive: true },
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true, trade: true, dailyWage: true },
        }),
        prisma.materialRequest.findMany({
          where: { requestedBy: userId },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            project: { select: { id: true, name: true, code: true } },
            items: {
              include: {
                material: { select: { id: true, name: true, unit: true } },
              },
            },
          },
        }),
      ]);

    return NextResponse.json({
      projects,
      myReports,
      recentTasks,
      materials,
      workers,
      myRequests,
    });
  } catch (error: any) {
    console.error("Site Engineer overview error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load site engineer overview" },
      { status: 500 }
    );
  }
}
