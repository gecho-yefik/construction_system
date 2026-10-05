import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ai/predictions - List AI predictions
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const where: any = {};
    if (projectId) where.projectId = projectId;

    const predictions = await prisma.aiPrediction.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      include: {
        project: { select: { id: true, name: true, code: true, budget: true, status: true } },
      },
    });

    return NextResponse.json(predictions);
  } catch (error: any) {
    console.error("AI Predictions GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch predictions" },
      { status: 500 }
    );
  }
}

// POST /api/ai/predictions - Run AI Analysis on a Project
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Fetch deep project data for AI model calculation
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: true,
        expenses: true,
        dailyReports: { orderBy: { date: "desc" }, take: 10 },
        attendances: true,
        materialRequests: true,
        workforce: { include: { worker: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 1. Cost Analysis
    const totalSpent = project.expenses.reduce((s, e) => s + e.amount, 0);
    const budget = project.budget || 1;
    const spendRatio = totalSpent / budget;

    // 2. Schedule & Task Progress
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter((t) => t.status === "COMPLETED").length;
    const overdueTasks = project.tasks.filter((t) => {
      if (t.status === "COMPLETED") return false;
      return new Date(t.dueDate) < new Date();
    }).length;
    const taskProgressPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // 3. Issue & Delay Indicators in Daily Reports
    const issueReportsCount = project.dailyReports.filter(
      (r) => r.issues && r.issues.trim().length > 5
    ).length;

    // --- AI Cost Overrun Predictor ---
    let predictedCostOverrunPct = 0;
    if (taskProgressPct > 0) {
      const projectedTotalCost = totalSpent / (taskProgressPct / 100);
      predictedCostOverrunPct = Math.max(0, ((projectedTotalCost - budget) / budget) * 100);
    } else if (spendRatio > 0.2) {
      predictedCostOverrunPct = (spendRatio - 0.2) * 50;
    }

    // --- AI Delay Predictor ---
    let predictedDelayDays = 0;
    if (overdueTasks > 0) {
      predictedDelayDays += overdueTasks * 7;
    }
    if (issueReportsCount > 0) {
      predictedDelayDays += issueReportsCount * 3;
    }
    if (taskProgressPct < 30 && spendRatio > 0.5) {
      predictedDelayDays += 14;
    }

    // --- Risk Level Evaluation ---
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (predictedCostOverrunPct > 35 || predictedDelayDays > 30 || overdueTasks >= 3) {
      riskLevel = "CRITICAL";
    } else if (predictedCostOverrunPct > 15 || predictedDelayDays > 14 || overdueTasks >= 1) {
      riskLevel = "HIGH";
    } else if (predictedCostOverrunPct > 5 || predictedDelayDays > 5 || spendRatio > 0.7) {
      riskLevel = "MEDIUM";
    }

    // Generate AI Insights & Recommendations
    const insights = `AI Diagnostic for [${project.code}]: Spend utilization is ${Math.round(
      spendRatio * 100
    )}% with ${Math.round(
      taskProgressPct
    )}% tasks completed. Predicted cost variance: ${predictedCostOverrunPct.toFixed(
      1
    )}% | Estimated schedule slip: ${predictedDelayDays} days. Key mitigation: ${
      overdueTasks > 0
        ? `Resolve ${overdueTasks} blocker tasks immediately and reallocate workforce trades.`
        : issueReportsCount > 0
        ? `Address recurrent site issues recorded by site engineers.`
        : `Operations are within acceptable baseline tolerance.`
    }`;

    // Store Cost Overrun Prediction
    const costPred = await prisma.aiPrediction.create({
      data: {
        projectId,
        predictionType: "COST_OVERRUN",
        predictedValue: Math.round(predictedCostOverrunPct * 10) / 10,
        confidence: 0.88,
        riskLevel,
        insights,
      },
    });

    // Store Delay Prediction
    const delayPred = await prisma.aiPrediction.create({
      data: {
        projectId,
        predictionType: "SCHEDULE_DELAY",
        predictedValue: predictedDelayDays,
        confidence: 0.85,
        riskLevel,
        insights: `Schedule forecast indicates a potential delay of ${predictedDelayDays} days based on milestone completion rates and active daily site report issues.`,
      },
    });

    return NextResponse.json({
      message: "AI analysis completed successfully",
      costPrediction: costPred,
      delayPrediction: delayPred,
      summary: {
        riskLevel,
        predictedCostOverrunPct: Math.round(predictedCostOverrunPct * 10) / 10,
        predictedDelayDays,
        totalTasks,
        completedTasks,
        overdueTasks,
        totalSpent,
        budget,
      },
    });
  } catch (error: any) {
    console.error("AI Run error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute AI analysis" },
      { status: 500 }
    );
  }
}
