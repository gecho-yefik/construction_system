import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/project-manager/overview
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    const isPM = userRole === "PROJECT_MANAGER";
    const isGM = userRole === "GENERAL_MANAGER";

    if (!isPM && !isGM) {
      return NextResponse.json(
        { error: "Forbidden: Access restricted to Project Managers and General Managers." },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    // Filter projects: if PM, show projects managed by or assigned to them (or all if GM)
    const projectWhere = isGM ? {} : { managerId: userId };

    const [
      assignedProjects,
      pendingRequests,
      allRequests,
      activeTasks,
      recentReports,
      workforce,
      attendances,
      aiPredictions,
      materials,
    ] = await Promise.all([
      // 1. Projects
      prisma.project.findMany({
        where: projectWhere,
        orderBy: { createdAt: "desc" },
        include: {
          manager: { select: { id: true, name: true, email: true, role: true } },
          creator: { select: { id: true, name: true, role: true } },
          _count: {
            select: {
              tasks: true,
              documents: true as any,
              workforce: true,
              dailyReports: true,
              materialRequests: true,
            },
          },
        },
      }),

      // 2. Pending Material Requests awaiting PM review
      prisma.materialRequest.findMany({
        where: {
          status: "PENDING",
          ...(isGM ? {} : { project: { managerId: userId } }),
        },
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true, code: true } },
          requester: { select: { id: true, name: true, email: true, role: true } },
          items: {
            include: {
              material: { select: { id: true, name: true, unit: true, unitPrice: true } },
            },
          },
        },
      }),

      // 3. All recent Material Requests (approved / rejected / fulfilled)
      prisma.materialRequest.findMany({
        where: isGM ? {} : { project: { managerId: userId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          project: { select: { id: true, name: true, code: true } },
          requester: { select: { id: true, name: true, email: true, role: true } },
          approver: { select: { id: true, name: true, role: true } },
          items: {
            include: {
              material: { select: { id: true, name: true, unit: true } },
            },
          },
        },
      }),

      // 4. Tasks across assigned projects
      prisma.task.findMany({
        where: isGM ? {} : { project: { managerId: userId } },
        orderBy: { dueDate: "asc" },
        include: {
          project: { select: { id: true, name: true, code: true } },
        },
      }),

      // 5. Daily Reports logged by Site Engineers
      prisma.dailyReport.findMany({
        where: isGM ? {} : { project: { managerId: userId } },
        orderBy: { date: "desc" },
        take: 10,
        include: {
          project: { select: { id: true, name: true, code: true } },
          engineer: { select: { id: true, name: true, email: true, role: true } },
        },
      }),

      // 6. Workforce assigned to managed projects
      prisma.workerAssignment.findMany({
        where: isGM ? {} : { project: { managerId: userId } },
        include: {
          worker: true,
          project: { select: { id: true, name: true, code: true } },
        },
        orderBy: { assignedAt: "desc" },
        take: 20,
      }),

      // 7. Recent site attendances
      prisma.attendance.findMany({
        where: isGM ? {} : { project: { managerId: userId } },
        include: {
          worker: true,
          project: { select: { id: true, name: true, code: true } },
        },
        orderBy: { date: "desc" },
        take: 20,
      }),

      // 8. AI Predictions for managed projects
      prisma.aiPrediction.findMany({
        where: isGM ? {} : { project: { managerId: userId } },
        include: {
          project: { select: { id: true, name: true, code: true } },
        },
        orderBy: { generatedAt: "desc" },
        take: 10,
      }),

      // 9. Materials list for reference
      prisma.material.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

    const completedTasksCount = activeTasks.filter((t) => t.status === "COMPLETED").length;
    const inProgressTasksCount = activeTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const pendingTasksCount = activeTasks.filter((t) => t.status === "PENDING" || t.status === "OVERDUE").length;

    return NextResponse.json({
      metrics: {
        assignedProjectsCount: assignedProjects.length,
        pendingApprovalsCount: pendingRequests.length,
        totalTasksCount: activeTasks.length,
        completedTasksCount,
        inProgressTasksCount,
        pendingTasksCount,
        dailyReportsCount: recentReports.length,
        totalWorkforceCount: workforce.length,
        aiPredictionsCount: aiPredictions.length,
      },
      assignedProjects,
      pendingRequests,
      allRequests,
      tasks: activeTasks,
      recentReports,
      workforce,
      attendances,
      aiPredictions,
      materials,
    });
  } catch (error: any) {
    console.error("Project Manager overview error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load Project Manager overview" },
      { status: 500 }
    );
  }
}
