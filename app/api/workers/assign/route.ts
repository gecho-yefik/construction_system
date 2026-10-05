import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { workerId, projectId, action } = body;

    if (!workerId || !projectId) {
      return NextResponse.json(
        { error: "workerId and projectId are required" },
        { status: 400 }
      );
    }

    if (action === "unassign") {
      await prisma.workerAssignment.deleteMany({
        where: { workerId, projectId },
      });
      return NextResponse.json({ message: "Worker unassigned from project" });
    }

    // Default: assign
    const assignment = await prisma.workerAssignment.upsert({
      where: {
        workerId_projectId: {
          workerId,
          projectId,
        },
      },
      update: {
        assignedAt: new Date(),
      },
      create: {
        workerId,
        projectId,
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        worker: { select: { id: true, fullName: true, trade: true } },
      },
    });

    return NextResponse.json(assignment);
  } catch (error: any) {
    console.error("Worker assignment error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update worker assignment" },
      { status: 500 }
    );
  }
}
