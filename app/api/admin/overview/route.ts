import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/overview - Real dynamic executive data for BuildMaster Admin Dashboard
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch real counts & aggregations concurrently
    const [
      totalProjects,
      completedProjects,
      inProgressProjects,
      plannedProjects,
      onHoldProjects,
      totalUsers,
      totalSuppliers,
      totalMaterials,
      materialRequestsCount,
      totalWorkers,
      expensesAggregate,
      projectsList,
      recentExpenses,
      recentMaterialRequests,
      recentProjects,
      recentUsers,
      recentAiPredictions,
      allTasks,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: "COMPLETED" } }),
      prisma.project.count({ where: { status: "IN_PROGRESS" } }),
      prisma.project.count({ where: { status: "PLANNED" } }),
      prisma.project.count({ where: { status: "ON_HOLD" } }),
      prisma.user.count(),
      prisma.supplier.count(),
      prisma.material.count(),
      prisma.materialRequest.count(),
      prisma.worker.count({ where: { isActive: true } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          manager: { select: { name: true } },
          tasks: { select: { id: true, status: true, dueDate: true } },
        },
      }),
      prisma.expense.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { project: { select: { name: true } } },
      }),
      prisma.materialRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { project: { select: { name: true } } },
      }),
      prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.aiPrediction.findMany({
        orderBy: { generatedAt: "desc" },
        take: 10,
        include: { project: { select: { name: true, code: true } } },
      }),
      prisma.task.findMany({
        select: { id: true, status: true, dueDate: true, projectId: true },
      }),
    ]);

    const todoProjects = plannedProjects + onHoldProjects;
    const totalExpenses = expensesAggregate._sum.amount || 0;
    const totalBudget = projectsList.reduce((acc, p) => acc + (p.budget || 0), 0);
    const remainingBudget = Math.max(0, totalBudget - totalExpenses);
    const spentPercentage = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;
    const remainingPercentage = totalBudget > 0 ? (remainingBudget / totalBudget) * 100 : 0;

    // 2. Real mapped projects with calculated progress
    const formattedProjects = projectsList.map((p) => {
      let statusLabel: "Completed" | "In Progress" | "To Do" = "In Progress";
      if (p.status === "COMPLETED") statusLabel = "Completed";
      else if (p.status === "PLANNED" || p.status === "ON_HOLD") statusLabel = "To Do";

      let progress = 0;
      if (p.status === "COMPLETED") {
        progress = 100;
      } else if (p.tasks && p.tasks.length > 0) {
        const completedTasks = p.tasks.filter((t) => t.status === "COMPLETED").length;
        progress = Math.round((completedTasks / p.tasks.length) * 100);
      } else if (p.status === "IN_PROGRESS") {
        progress = 50;
      }

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
        manager: p.manager?.name || "Unassigned",
        status: statusLabel,
        progress,
        endDate: dateFormatted,
        budget: p.budget || 0,
      };
    });

    // 3. Construct real dynamic activities
    const activities: Array<{
      id: string;
      title: string;
      time: string;
      rawDate: Date;
      type: "project" | "request" | "order" | "user" | "payment";
    }> = [];

    // Add recent projects
    for (const p of recentProjects) {
      activities.push({
        id: `p-${p.id}`,
        title: `New project "${p.name}" created`,
        time: formatRelativeTime(p.createdAt),
        rawDate: p.createdAt,
        type: "project",
      });
    }

    // Add recent material requests
    for (const mr of recentMaterialRequests) {
      activities.push({
        id: `mr-${mr.id}`,
        title: `Material request #${mr.id.slice(-4).toUpperCase()} ${mr.status.toLowerCase()}`,
        time: formatRelativeTime(mr.createdAt),
        rawDate: mr.createdAt,
        type: "request",
      });
    }

    // Add recent expenses
    for (const exp of recentExpenses) {
      activities.push({
        id: `exp-${exp.id}`,
        title: `Payment of $${exp.amount.toLocaleString()} recorded`,
        time: formatRelativeTime(exp.createdAt),
        rawDate: exp.createdAt,
        type: "payment",
      });
    }

    // Add recent users
    for (const u of recentUsers) {
      if (u.name) {
        activities.push({
          id: `u-${u.id}`,
          title: `User ${u.name} added to the system`,
          time: formatRelativeTime(u.createdAt),
          rawDate: u.createdAt,
          type: "user",
        });
      }
    }

    // Sort combined activities by most recent
    activities.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
    const finalActivities = activities.slice(0, 5).map(({ id, title, time, type }) => ({
      id,
      title,
      time,
      type,
    }));

    // 4. Calculate real delay risk
    const now = new Date();
    const overdueTasks = allTasks.filter(
      (t) => t.status !== "COMPLETED" && new Date(t.dueDate) < now
    );
    const projectsWithOverdue = new Set(overdueTasks.map((t) => t.projectId)).size;

    // High, Medium, Low risk counts
    const highRiskCount = recentAiPredictions.filter((a) => a.riskLevel === "HIGH" || a.riskLevel === "CRITICAL").length || (projectsWithOverdue > 0 ? 1 : 0);
    const mediumRiskCount = recentAiPredictions.filter((a) => a.riskLevel === "MEDIUM").length || (projectsWithOverdue > 1 ? 1 : 0);
    const lowRiskCount = Math.max(0, totalProjects - highRiskCount - mediumRiskCount);

    // Cost prediction calculation
    const predictedVariance = totalBudget > 0 ? Math.round(((totalExpenses * 1.12) / totalBudget) * 100 - 100) : 0;
    const predictedCostValue = totalBudget > 0 ? totalBudget * (1 + Math.max(0, predictedVariance) / 100) : totalExpenses;

    return NextResponse.json({
      metrics: {
        totalProjects,
        completedProjects,
        inProgressProjects,
        todoProjects,
        completedPercentage: totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 1000) / 10 : 0,
        inProgressPercentage: totalProjects > 0 ? Math.round((inProgressProjects / totalProjects) * 1000) / 10 : 0,
        todoPercentage: totalProjects > 0 ? Math.round((todoProjects / totalProjects) * 1000) / 10 : 0,
        totalUsers,
        totalExpenses,
        totalBudget,
        remainingBudget,
        spentPercentage: Math.round(spentPercentage * 10) / 10,
        remainingPercentage: Math.round(remainingPercentage * 10) / 10,
        totalSuppliers,
        totalMaterials,
        materialRequestsCount,
        totalWorkforce: totalWorkers,
      },
      projects: formattedProjects,
      activities: finalActivities,
      aiPredictions: {
        predictedFinalCost: predictedCostValue,
        costVariancePercentage: predictedVariance > 0 ? `+${predictedVariance}%` : `${predictedVariance}%`,
        projectsAtRisk: projectsWithOverdue || (highRiskCount + mediumRiskCount),
        riskBreakdown: {
          high: highRiskCount,
          medium: mediumRiskCount,
          low: lowRiskCount,
        },
      },
    });
  } catch (error: any) {
    console.error("Admin Overview API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch admin overview" },
      { status: 500 }
    );
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "Just now";
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}
