import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/general-manager/overview - Executive summary for General Manager module
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    if (userRole !== "GENERAL_MANAGER") {
      return NextResponse.json(
        { error: "Forbidden: Access restricted to General Manager only." },
        { status: 403 }
      );
    }

    // 1. Executive Aggregations
    const [
      totalProjects,
      activeProjects,
      plannedProjects,
      completedProjects,
      projects,
      totalWorkers,
      managersList,
      expensesSum,
      expensesByCategory,
      recentExpenses,
      pendingMaterialRequests,
      recentAiPredictions,
      recentFieldReports,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: "IN_PROGRESS" } }),
      prisma.project.count({ where: { status: "PLANNED" } }),
      prisma.project.count({ where: { status: "COMPLETED" } }),
      prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          creator: { select: { id: true, name: true, role: true } },
          manager: { select: { id: true, name: true, email: true, role: true } },
          _count: {
            select: {
              documents: true as any,
              tasks: true,
              workforce: true,
              dailyReports: true,
              expenses: true,
            },
          },
        },
      }),
      prisma.worker.count({ where: { isActive: true } }),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({
        by: ["category"],
        _sum: { amount: true },
      }),
      prisma.expense.findMany({
        orderBy: { expenseDate: "desc" },
        take: 10,
        include: {
          project: { select: { id: true, name: true, code: true } },
          recordedBy: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.materialRequest.count({ where: { status: "PENDING" } }),
      prisma.aiPrediction.findMany({
        orderBy: { generatedAt: "desc" },
        take: 8,
        include: {
          project: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.dailyReport.findMany({
        orderBy: { date: "desc" },
        take: 8,
        include: {
          project: { select: { id: true, name: true, code: true } },
          engineer: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    const totalBudget = projects.reduce((acc, p) => acc + (p.budget || 0), 0);
    const totalExpenses = expensesSum._sum.amount || 0;
    const remainingBudget = totalBudget - totalExpenses;
    const budgetUtilization = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

    return NextResponse.json({
      metrics: {
        totalProjects,
        activeProjects,
        plannedProjects,
        completedProjects,
        totalBudget,
        totalExpenses,
        remainingBudget,
        budgetUtilization: Math.round(budgetUtilization * 10) / 10,
        totalWorkers,
        pendingMaterialRequests,
      },
      projects,
      managersList,
      expensesByCategory: expensesByCategory.map((c) => ({
        category: c.category,
        totalAmount: c._sum.amount || 0,
      })),
      recentExpenses,
      aiPredictions: recentAiPredictions,
      recentFieldReports,
    });
  } catch (error: any) {
    console.error("General Manager overview error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load General Manager overview" },
      { status: 500 }
    );
  }
}
