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

    const [
      projects,
      expensesSum,
      expensesByCategory,
      recentExpenses,
      purchaseOrders,
      attendances,
    ] = await Promise.all([
      prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          manager: { select: { id: true, name: true, email: true } },
          _count: {
            select: {
              expenses: true,
              tasks: true,
              workforce: true,
            },
          },
          expenses: {
            select: {
              amount: true,
              category: true,
            },
          },
        },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({
        by: ["category"],
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.findMany({
        orderBy: { expenseDate: "desc" },
        take: 20,
        include: {
          project: { select: { id: true, name: true, code: true, budget: true } },
          recordedBy: { select: { id: true, name: true, role: true } },
          purchaseOrder: {
            select: {
              id: true,
              supplier: { select: { name: true } },
            },
          },
        },
      }),
      prisma.purchaseOrder.findMany({
        orderBy: { orderedAt: "desc" },
        take: 10,
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              material: { select: { id: true, name: true, unit: true } },
            },
          },
        },
      }),
      prisma.attendance.findMany({
        where: { status: "PRESENT" },
        include: {
          worker: { select: { dailyWage: true } },
        },
      }),
    ]);

    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalExpenses = expensesSum._sum.amount || 0;
    const remainingBudget = totalBudget - totalExpenses;
    const budgetUtilization = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

    // Calculate labor costs from attendance
    const estimatedLaborFromAttendance = attendances.reduce((sum, a) => {
      const wage = a.worker?.dailyWage || 0;
      const hours = a.hoursWorked || 8;
      return sum + (wage * (hours / 8));
    }, 0);

    // Project financial cards
    const projectFinancials = projects.map((p) => {
      const pExpense = p.expenses.reduce((s, e) => s + e.amount, 0);
      const variance = (p.budget || 0) - pExpense;
      const pct = p.budget > 0 ? (pExpense / p.budget) * 100 : 0;
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        status: p.status,
        budget: p.budget,
        totalSpent: pExpense,
        remaining: variance,
        utilizationPct: Math.round(pct * 10) / 10,
        isOverBudget: pExpense > p.budget,
        manager: p.manager,
      };
    });

    return NextResponse.json({
      summary: {
        totalBudget,
        totalExpenses,
        remainingBudget,
        budgetUtilization: Math.round(budgetUtilization * 10) / 10,
        totalProjects: projects.length,
        estimatedLaborFromAttendance: Math.round(estimatedLaborFromAttendance),
      },
      categoryBreakdown: expensesByCategory.map((c) => ({
        category: c.category,
        totalAmount: c._sum.amount || 0,
        transactionCount: c._count.id,
      })),
      projectFinancials,
      recentExpenses,
      recentPurchaseOrders: purchaseOrders,
    });
  } catch (error: any) {
    console.error("Finance overview error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load financial overview" },
      { status: 500 }
    );
  }
}
