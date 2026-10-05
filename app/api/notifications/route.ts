import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

export interface RealNotificationItem {
  id: string;
  title: string;
  description?: string;
  time: string;
  rawDate: string;
  type: "request" | "project" | "payment" | "user" | "order" | "ai" | "report";
  priority: "HIGH" | "MEDIUM" | "LOW";
  link: string;
  read: boolean;
  metadata?: {
    projectName?: string;
    userName?: string;
    amount?: number;
    status?: string;
  };
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return `${mins}m ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// GET /api/notifications - Real live notifications aggregated from database events
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Fetch concurrent real activity sources
    const [
      pendingMaterialRequests,
      recentExpenses,
      recentAiPredictions,
      overdueTasks,
      recentDailyReports,
      recentProjects,
      recentUsers,
    ] = await Promise.all([
      // 1. Pending Material Requests needing approval
      prisma.materialRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          project: { select: { name: true, code: true } },
          requester: { select: { name: true } },
          items: { select: { id: true, quantityRequested: true } },
        },
      }),

      // 2. Recent Expenses / Payments
      prisma.expense.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          project: { select: { name: true } },
          recordedBy: { select: { name: true } },
        },
      }),

      // 3. AI Risk Alerts
      prisma.aiPrediction.findMany({
        orderBy: { generatedAt: "desc" },
        take: 5,
        include: {
          project: { select: { name: true, code: true } },
        },
      }),

      // 4. Overdue Tasks
      prisma.task.findMany({
        where: {
          status: { not: "COMPLETED" },
          dueDate: { lt: now },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        include: {
          project: { select: { name: true } },
        },
      }),

      // 5. Recent Daily Reports
      prisma.dailyReport.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          project: { select: { name: true } },
          engineer: { select: { name: true } },
        },
      }),

      // 6. Recent Projects
      prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          manager: { select: { name: true } },
        },
      }),

      // 7. Recent Users
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, name: true, role: true, createdAt: true },
      }),
    ]);

    const notifications: RealNotificationItem[] = [];

    // Map Material Requests
    for (const mr of pendingMaterialRequests) {
      const isPending = mr.status === "PENDING" || (mr.status as string) === "SUBMITTED";
      notifications.push({
        id: `mr-${mr.id}`,
        title: isPending
          ? `Pending Request: ${mr.items.length} item(s) for ${mr.project?.name || "Project"}`
          : `Material Request #${mr.id.slice(-4).toUpperCase()} is ${mr.status.toLowerCase()}`,
        description: mr.notes || `Requested by ${mr.requester?.name || "Site Engineer"}`,
        time: formatRelativeTime(mr.createdAt),
        rawDate: mr.createdAt.toISOString(),
        type: "request",
        priority: isPending ? "HIGH" : "MEDIUM",
        link: "/procurement-officer",
        read: false,
        metadata: {
          projectName: mr.project?.name,
          userName: mr.requester?.name || undefined,
          status: mr.status,
        },
      });
    }

    // Map AI Predictions
    for (const ai of recentAiPredictions) {
      const isHighRisk = ai.riskLevel === "HIGH" || ai.riskLevel === "CRITICAL";
      notifications.push({
        id: `ai-${ai.id}`,
        title: `AI Risk Alert: ${ai.project?.name || "Project"} (${ai.riskLevel} Risk)`,
        description: ai.insights || `Confidence score: ${Math.round((ai.confidence || 0.85) * 100)}%`,
        time: formatRelativeTime(ai.generatedAt),
        rawDate: ai.generatedAt.toISOString(),
        type: "ai",
        priority: isHighRisk ? "HIGH" : "MEDIUM",
        link: "/ai-analytics",
        read: false,
        metadata: {
          projectName: ai.project?.name,
          status: ai.riskLevel,
        },
      });
    }

    // Map Overdue Tasks
    for (const task of overdueTasks) {
      notifications.push({
        id: `task-${task.id}`,
        title: `Overdue Task: "${task.name}"`,
        description: `Project: ${task.project?.name || "Unknown"} (Due ${new Date(task.dueDate).toLocaleDateString()})`,
        time: formatRelativeTime(task.dueDate),
        rawDate: task.dueDate.toISOString(),
        type: "project",
        priority: "HIGH",
        link: "/projects",
        read: false,
        metadata: {
          projectName: task.project?.name,
          status: "OVERDUE",
        },
      });
    }

    // Map Expenses
    for (const exp of recentExpenses) {
      notifications.push({
        id: `exp-${exp.id}`,
        title: `Expense Payment: $${exp.amount.toLocaleString()}`,
        description: `${exp.description || "General expense"} &bull; ${exp.project?.name || "Project"}`,
        time: formatRelativeTime(exp.createdAt),
        rawDate: exp.createdAt.toISOString(),
        type: "payment",
        priority: exp.amount > 10000 ? "HIGH" : "LOW",
        link: "/accountant",
        read: false,
        metadata: {
          projectName: exp.project?.name,
          amount: exp.amount,
        },
      });
    }

    // Map Daily Reports
    for (const dr of recentDailyReports) {
      notifications.push({
        id: `dr-${dr.id}`,
        title: `Daily Site Log: ${dr.project?.name || "Project"}`,
        description: `Submitted by ${dr.engineer?.name || "Site Engineer"} (Weather: ${dr.weatherCondition || "Clear"})`,
        time: formatRelativeTime(dr.createdAt),
        rawDate: dr.createdAt.toISOString(),
        type: "report",
        priority: "LOW",
        link: "/hr-manager",
        read: false,
        metadata: {
          projectName: dr.project?.name,
          userName: dr.engineer?.name || undefined,
        },
      });
    }

    // Map Recent Projects
    for (const p of recentProjects) {
      notifications.push({
        id: `p-${p.id}`,
        title: `New Project: "${p.name}"`,
        description: `Manager: ${p.manager?.name || "Unassigned"} &bull; Budget: $${(p.budget || 0).toLocaleString()}`,
        time: formatRelativeTime(p.createdAt),
        rawDate: p.createdAt.toISOString(),
        type: "project",
        priority: "LOW",
        link: "/projects",
        read: false,
        metadata: {
          projectName: p.name,
          amount: p.budget,
        },
      });
    }

    // Map Recent Users
    for (const u of recentUsers) {
      if (u.name) {
        notifications.push({
          id: `u-${u.id}`,
          title: `New User: ${u.name}`,
          description: `Assigned role: ${u.role?.replace("_", " ") || "Member"}`,
          time: formatRelativeTime(u.createdAt),
          rawDate: u.createdAt.toISOString(),
          type: "user",
          priority: "LOW",
          link: "/admin",
          read: false,
          metadata: {
            userName: u.name,
          },
        });
      }
    }

    // Sort by latest rawDate
    notifications.sort(
      (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()
    );

    return NextResponse.json({
      notifications,
      unreadCount: notifications.length,
      totalCount: notifications.length,
    });
  } catch (err) {
    console.error("Failed to load notifications:", err);
    return NextResponse.json(
      { error: "Internal Server Error", notifications: [], unreadCount: 0 },
      { status: 500 }
    );
  }
}
