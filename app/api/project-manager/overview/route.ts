import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

function formatRelativeTime(date: Date | string | null): string {
  if (!date) return "Recently";
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// GET /api/project-manager/overview
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    const isPM = userRole === "PROJECT_MANAGER";
    const isGM = userRole === "GENERAL_MANAGER" || userRole === "ADMIN";

    if (!isPM && !isGM) {
      return NextResponse.json(
        { error: "Forbidden: Access restricted to Project Managers and General Managers." },
        { status: 403 }
      );
    }

    const userId = session.user.id;
    const projectWhere = isGM ? {} : { managerId: userId };

    const [
      assignedProjects,
      pendingRequests,
      allRequests,
      activeTasks,
      recentReports,
      workforce,
      attendances,
      materials,
      suppliers,
      purchaseOrders,
      projectExpenses,
    ] = await Promise.all([
      // 1. Assigned Projects with tasks and relations
      prisma.project.findMany({
        where: projectWhere,
        orderBy: { createdAt: "desc" },
        include: {
          manager: { select: { id: true, name: true, email: true, role: true } },
          creator: { select: { id: true, name: true, role: true } },
          tasks: { select: { id: true, status: true, dueDate: true, name: true, completedAt: true } },
          expenses: { select: { id: true, amount: true, category: true } },
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

      // 2. Pending Material Requests
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

      // 3. All recent Material Requests
      prisma.materialRequest.findMany({
        where: isGM ? {} : { project: { managerId: userId } },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          project: { select: { id: true, name: true, code: true } },
          requester: { select: { id: true, name: true, email: true, role: true } },
          approver: { select: { id: true, name: true, role: true } },
          items: {
            include: {
              material: { select: { id: true, name: true, unit: true, unitPrice: true } },
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
        take: 30,
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
      }),

      // 7. Recent site attendances
      prisma.attendance.findMany({
        where: isGM ? {} : { project: { managerId: userId } },
        include: {
          worker: true,
          project: { select: { id: true, name: true, code: true } },
        },
        orderBy: { date: "desc" },
        take: 40,
      }),

      // 8. Materials list with inventory stock
      prisma.material.findMany({
        orderBy: { name: "asc" },
      }),

      // 9. Suppliers
      prisma.supplier.findMany({
        orderBy: { name: "asc" },
        take: 30,
      }),

      // 10. Purchase Orders (Procurement)
      prisma.purchaseOrder.findMany({
        orderBy: { orderedAt: "desc" },
        take: 20,
        include: {
          supplier: { select: { name: true, phone: true } },
          items: {
            include: {
              material: { select: { name: true, unit: true } },
            },
          },
        },
      }),

      // 11. Expenses for these projects
      prisma.expense.findMany({
        where: isGM ? {} : { project: { managerId: userId } },
        orderBy: { expenseDate: "desc" },
        include: {
          project: { select: { id: true, name: true, code: true } },
          recordedBy: { select: { name: true } },
        },
      }),
    ]);

    // Metric Calculations
    const totalProjects = assignedProjects.length;
    const completedProjects = assignedProjects.filter((p) => p.status === "COMPLETED").length;
    const inProgressProjects = assignedProjects.filter((p) => p.status === "IN_PROGRESS").length;
    const todoProjects = assignedProjects.filter((p) => p.status === "PLANNED" || p.status === "ON_HOLD").length;

    const completedPercentage = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 1000) / 10 : 0;
    const inProgressPercentage = totalProjects > 0 ? Math.round((inProgressProjects / totalProjects) * 1000) / 10 : 0;
    const todoPercentage = totalProjects > 0 ? Math.round((todoProjects / totalProjects) * 1000) / 10 : 0;

    const totalBudget = assignedProjects.reduce((acc, p) => acc + (p.budget || 0), 0);
    const totalExpenses = projectExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const remainingBudget = Math.max(0, totalBudget - totalExpenses);
    const spentPercentage = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 1000) / 10 : 0;
    const remainingPercentage = totalBudget > 0 ? Math.round((remainingBudget / totalBudget) * 1000) / 10 : 0;

    // Financial Breakdown
    const laborExpenses = projectExpenses
      .filter((e) => e.category === "LABOR")
      .reduce((acc, e) => acc + e.amount, 0);

    const procurementExpenses = projectExpenses
      .filter((e) => e.category === "MATERIALS" || e.category === "EQUIPMENT")
      .reduce((acc, e) => acc + e.amount, 0);

    const otherExpenses = totalExpenses - (laborExpenses + procurementExpenses);

    // Tasks Calculation
    const completedTasksCount = activeTasks.filter((t) => t.status === "COMPLETED").length;
    const inProgressTasksCount = activeTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const pendingTasksCount = activeTasks.filter((t) => t.status === "PENDING" || t.status === "OVERDUE").length;
    const taskCompletionRate = activeTasks.length > 0 ? Math.round((completedTasksCount / activeTasks.length) * 100) : 0;

    // Low stock materials
    const lowStockMaterials = materials.filter((m) => m.quantity <= m.reorderLevel);

    // Format Projects with cost comparison and progress
    const formattedProjects = assignedProjects.map((p) => {
      let statusLabel: "Completed" | "In Progress" | "To Do" = "In Progress";
      if (p.status === "COMPLETED") statusLabel = "Completed";
      else if (p.status === "PLANNED" || p.status === "ON_HOLD") statusLabel = "To Do";

      let progress = 0;
      if (p.status === "COMPLETED") {
        progress = 100;
      } else if (p.tasks && p.tasks.length > 0) {
        const comp = p.tasks.filter((t) => t.status === "COMPLETED").length;
        progress = Math.round((comp / p.tasks.length) * 100);
      } else if (p.status === "IN_PROGRESS") {
        progress = 50;
      }

      const pExpenses = p.expenses?.reduce((acc: number, e: { amount: number }) => acc + e.amount, 0) || 0;
      const pRemaining = Math.max(0, (p.budget || 0) - pExpenses);
      const pSpentPct = p.budget > 0 ? Math.round((pExpenses / p.budget) * 100) : 0;

      const dateFormatted = p.endDate
        ? new Date(p.endDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : p.startDate
        ? new Date(p.startDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "N/A";

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        location: p.location,
        description: p.description,
        manager: p.manager?.name || "Assigned PM",
        status: statusLabel,
        progress,
        endDate: dateFormatted,
        startDate: new Date(p.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        budget: p.budget || 0,
        spent: pExpenses,
        remaining: pRemaining,
        spentPercentage: pSpentPct,
        tasksCount: p.tasks?.length || 0,
        completedTasksCount: p.tasks?.filter((t: { status: string }) => t.status === "COMPLETED").length || 0,
        reportsCount: p._count?.dailyReports || 0,
        workforceCount: p._count?.workforce || 0,
      };
    });

    // Dynamic Activities Timeline
    const activities: Array<{
      id: string;
      title: string;
      time: string;
      rawDate: Date;
      type: "project" | "request" | "order" | "user" | "payment" | "report";
    }> = [];

    // Pending requests
    for (const r of pendingRequests.slice(0, 4)) {
      activities.push({
        id: `req-${r.id}`,
        title: `Material requisition for "${r.project.name}" pending review`,
        time: formatRelativeTime(r.createdAt),
        rawDate: new Date(r.createdAt),
        type: "request",
      });
    }

    // Daily reports
    for (const d of recentReports.slice(0, 3)) {
      activities.push({
        id: `rep-${d.id}`,
        title: `Daily report filed for "${d.project.name}" by ${d.engineer.name || "Site Engineer"}`,
        time: formatRelativeTime(d.date),
        rawDate: new Date(d.date),
        type: "report",
      });
    }

    // Recent tasks
    for (const t of activeTasks.slice(0, 3)) {
      activities.push({
        id: `task-${t.id}`,
        title: `Milestone "${t.name}" status: ${t.status}`,
        time: formatRelativeTime(t.startDate),
        rawDate: new Date(t.startDate),
        type: "project",
      });
    }

    activities.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

    return NextResponse.json({
      metrics: {
        totalProjects,
        completedProjects,
        inProgressProjects,
        todoProjects,
        completedPercentage,
        inProgressPercentage,
        todoPercentage,
        assignedProjectsCount: totalProjects,
        pendingApprovalsCount: pendingRequests.length,
        totalTasksCount: activeTasks.length,
        completedTasksCount,
        inProgressTasksCount,
        pendingTasksCount,
        taskCompletionRate,
        dailyReportsCount: recentReports.length,
        totalWorkforce: workforce.length,
        totalExpenses,
        totalBudget,
        remainingBudget,
        spentPercentage,
        remainingPercentage,
        laborExpenses,
        procurementExpenses,
        otherExpenses,
        totalSuppliers: suppliers.length,
        totalMaterials: materials.length,
        lowStockMaterialsCount: lowStockMaterials.length,
        totalPurchaseOrders: purchaseOrders.length,
        materialRequestsCount: allRequests.length + pendingRequests.length,
      },
      projects: formattedProjects,
      assignedProjects,
      pendingRequests,
      allRequests,
      tasks: activeTasks,
      recentReports,
      workforce,
      attendances,
      materials,
      suppliers,
      purchaseOrders,
      expenses: projectExpenses,
      activities: activities.slice(0, 8),
    });
  } catch (error: any) {
    console.error("Project Manager overview error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load Project Manager overview" },
      { status: 500 }
    );
  }
}
