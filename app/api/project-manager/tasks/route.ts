import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/project-manager/tasks - Create a worksite task / milestone
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    if (userRole !== "PROJECT_MANAGER" && userRole !== "GENERAL_MANAGER") {
      return NextResponse.json(
        { error: "Forbidden: Only Project Managers and General Managers can schedule tasks." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { projectId, name, description, status, startDate, dueDate } = body;

    if (!projectId || !name || !startDate || !dueDate) {
      return NextResponse.json(
        { error: "Missing required fields (projectId, name, startDate, dueDate)" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        name: name.trim(),
        description: description?.trim() || null,
        status: status || "PENDING",
        startDate: new Date(startDate),
        dueDate: new Date(dueDate),
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create task" },
      { status: 500 }
    );
  }
}
