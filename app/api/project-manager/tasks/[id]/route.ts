import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/project-manager/tasks/[id] - Update task status / details
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId } = await params;
    const body = await req.json();
    const { status, name, description, dueDate } = body;

    const data: any = {};
    if (status) {
      data.status = status;
      if (status === "COMPLETED") {
        data.completedAt = new Date();
      } else {
        data.completedAt = null;
      }
    }
    if (name) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (dueDate) data.dueDate = new Date(dueDate);

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error: any) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE /api/project-manager/tasks/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId } = await params;
    await prisma.task.delete({ where: { id: taskId } });

    return NextResponse.json({ success: true, message: "Task deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete task" },
      { status: 500 }
    );
  }
}
