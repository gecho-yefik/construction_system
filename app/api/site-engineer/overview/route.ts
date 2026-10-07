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

    // Fetch projects, daily reports, active tasks, material catalog, workforce roster, attendance, and requisitions
    const [
      projects,
      myReports,
      allTasks,
      materials,
      workers,
      myRequests,
      recentAttendances,
      issuances,
    ] = await Promise.all([
      prisma.project.findMany({
        where: { status: { in: ["IN_PROGRESS", "PLANNED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          manager: { select: { id: true, name: true, email: true } },
          workforce: {
            include: {
              worker: true,
            },
          },
          tasks: {
            orderBy: { dueDate: "asc" },
          },
          _count: {
            select: {
              tasks: true,
              dailyReports: true,
              materialRequests: true,
              workforce: true,
            },
          },
        },
      }),

      prisma.dailyReport.findMany({
        where: { engineerId: userId },
        orderBy: { date: "desc" },
        take: 30,
        include: {
          project: { select: { id: true, name: true, code: true, location: true } },
        },
      }),

      prisma.task.findMany({
        orderBy: { dueDate: "asc" },
        include: {
          project: { select: { id: true, name: true, code: true } },
        },
      }),

      prisma.material.findMany({
        orderBy: { name: "asc" },
      }),

      prisma.worker.findMany({
        where: { isActive: true },
        orderBy: { fullName: "asc" },
        include: {
          assignments: {
            include: {
              project: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),

      prisma.materialRequest.findMany({
        where: { requestedBy: userId },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          project: { select: { id: true, name: true, code: true } },
          approver: { select: { id: true, name: true } },
          items: {
            include: {
              material: { select: { id: true, name: true, unit: true, quantity: true, unitPrice: true } },
            },
          },
        },
      }),

      prisma.attendance.findMany({
        orderBy: { date: "desc" },
        take: 50,
        include: {
          worker: true,
          project: { select: { id: true, name: true, code: true } },
        },
      }),

      prisma.materialIssuance.findMany({
        orderBy: { issuedAt: "desc" },
        take: 20,
        include: {
          project: { select: { id: true, name: true, code: true } },
          items: {
            include: {
              material: { select: { name: true, unit: true } },
            },
          },
        },
      }),
    ]);

    // Metric Calculations
    const completedTasksCount = allTasks.filter((t) => t.status === "COMPLETED").length;
    const inProgressTasksCount = allTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const pendingTasksCount = allTasks.filter((t) => t.status === "PENDING" || t.status === "OVERDUE").length;
    const taskCompletionRate = allTasks.length > 0 ? Math.round((completedTasksCount / allTasks.length) * 100) : 0;

    const pendingRequestsCount = myRequests.filter((r) => r.status === "PENDING").length;
    const approvedRequestsCount = myRequests.filter((r) => r.status === "APPROVED").length;

    // Today's attendance stats
    const todayStr = new Date().toISOString().split("T")[0];
    const todayAttendances = recentAttendances.filter(
      (a) => new Date(a.date).toISOString().split("T")[0] === todayStr
    );
    const presentWorkersToday = todayAttendances.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length;

    // Format Projects with calculated progress
    const formattedProjects = projects.map((p) => {
      const comp = p.tasks.filter((t) => t.status === "COMPLETED").length;
      const progress = p.tasks.length > 0 ? Math.round((comp / p.tasks.length) * 100) : p.status === "IN_PROGRESS" ? 45 : 0;

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        location: p.location,
        status: p.status,
        progress,
        manager: p.manager?.name || "Project Manager",
        tasksCount: p.tasks.length,
        completedTasksCount: comp,
        workforceCount: p.workforce.length,
        reportsCount: p._count.dailyReports,
        tasks: p.tasks,
        workforce: p.workforce,
      };
    });

    return NextResponse.json({
      metrics: {
        totalActiveProjects: projects.length,
        totalTasksCount: allTasks.length,
        completedTasksCount,
        inProgressTasksCount,
        pendingTasksCount,
        taskCompletionRate,
        myReportsCount: myReports.length,
        totalWorkers: workers.length,
        presentWorkersToday,
        pendingRequestsCount,
        approvedRequestsCount,
        totalMaterials: materials.length,
      },
      projects: formattedProjects,
      myReports,
      tasks: allTasks,
      materials,
      workers,
      myRequests,
      recentAttendances,
      issuances,
    });
  } catch (error: any) {
    console.error("Site Engineer overview error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load site engineer overview" },
      { status: 500 }
    );
  }
}
