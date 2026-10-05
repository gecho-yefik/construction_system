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

    const [projects, allPredictions] = await Promise.all([
      prisma.project.findMany({
        where: { status: { in: ["IN_PROGRESS", "PLANNED"] } },
        include: {
          expenses: true,
          tasks: true,
          dailyReports: { take: 5, orderBy: { date: "desc" } },
          workforce: { include: { worker: true } },
          aiPredictions: { orderBy: { generatedAt: "desc" }, take: 2 },
        },
      }),
      prisma.aiPrediction.findMany({
        orderBy: { generatedAt: "desc" },
        take: 20,
        include: {
          project: { select: { id: true, name: true, code: true, budget: true } },
        },
      }),
    ]);

    const riskSummary = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    const projectAnalysis = projects.map((p) => {
      const totalSpent = p.expenses.reduce((s, e) => s + e.amount, 0);
      const budget = p.budget || 1;
      const spendRatio = totalSpent / budget;
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t) => t.status === "COMPLETED").length;
      const overdueTasks = p.tasks.filter(
        (t) => t.status !== "COMPLETED" && new Date(t.dueDate) < new Date()
      ).length;
      const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Deterministic risk calculation
      let risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
      let predictedDelay = overdueTasks * 7 + (taskProgress < 20 && spendRatio > 0.5 ? 14 : 0);
      let predictedCostOverrun =
        taskProgress > 0
          ? Math.max(0, ((totalSpent / (taskProgress / 100) - budget) / budget) * 100)
          : 0;

      if (predictedCostOverrun > 30 || predictedDelay > 30 || overdueTasks >= 3) {
        risk = "CRITICAL";
      } else if (predictedCostOverrun > 15 || predictedDelay > 14 || overdueTasks >= 1) {
        risk = "HIGH";
      } else if (predictedCostOverrun > 5 || predictedDelay > 5 || spendRatio > 0.7) {
        risk = "MEDIUM";
      }

      riskSummary[risk] = (riskSummary[risk] || 0) + 1;

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        budget,
        totalSpent,
        spendRatio: Math.round(spendRatio * 100),
        taskProgress: Math.round(taskProgress),
        overdueTasks,
        riskLevel: risk,
        predictedDelayDays: predictedDelay,
        predictedCostOverrunPct: Math.round(predictedCostOverrun * 10) / 10,
        workerCount: p.workforce.length,
        recommendation:
          risk === "CRITICAL" || risk === "HIGH"
            ? `Immediate management intervention recommended: rectify ${overdueTasks} overdue tasks and re-evaluate budget allocations.`
            : `Project velocity is optimal; maintain standard daily progress tracking.`,
      };
    });

    return NextResponse.json({
      riskSummary,
      projectAnalysis,
      recentPredictions: allPredictions,
    });
  } catch (error: any) {
    console.error("AI Overview error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load AI overview" },
      { status: 500 }
    );
  }
}
