import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/workers/[id] - Fetch detailed worker profile, assignments & attendance statistics
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const worker = await prisma.worker.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                code: true,
                status: true,
                location: true,
              },
            },
          },
        },
        attendances: {
          orderBy: { date: "desc" },
          take: 60,
          include: {
            project: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        _count: {
          select: {
            assignments: true,
            attendances: true,
          },
        },
      },
    });

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    // Calculate workforce metrics
    const presentDays = worker.attendances.filter((a) => a.status === "PRESENT").length;
    const halfDays = worker.attendances.filter((a) => a.status === "HALF_DAY").length;
    const totalHoursWorked = worker.attendances.reduce((acc, a) => acc + (a.hoursWorked || 0), 0);
    const estimatedEarnings = (presentDays + halfDays * 0.5) * worker.dailyWage;

    return NextResponse.json({
      worker,
      stats: {
        totalAssignments: worker._count.assignments,
        totalAttendanceLogs: worker._count.attendances,
        presentDays,
        halfDays,
        totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
        estimatedEarnings: Math.round(estimatedEarnings * 100) / 100,
      },
    });
  } catch (error: any) {
    console.error("Worker GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch worker details" },
      { status: 500 }
    );
  }
}

// PUT / PATCH /api/workers/[id] - Update worker profile or project assignment
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleWorkerUpdate(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleWorkerUpdate(req, params);
}

async function handleWorkerUpdate(
  req: NextRequest,
  paramsPromise: Promise<{ id: string }>
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    const allowedRoles = ["HR_MANAGER", "GENERAL_MANAGER", "PROJECT_MANAGER"];
    if (userRole && !allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden: You lack permission to update worker information." },
        { status: 403 }
      );
    }

    const { id } = await paramsPromise;
    const body = await req.json();
    const { fullName, nationalId, phoneNumber, trade, dailyWage, isActive, projectId } = body;

    const data: any = {};
    if (fullName !== undefined && fullName !== null) {
      data.fullName = String(fullName).trim();
    }
    if (nationalId !== undefined) {
      data.nationalId = nationalId && String(nationalId).trim() ? String(nationalId).trim() : null;
    }
    if (phoneNumber !== undefined) {
      data.phoneNumber = phoneNumber && String(phoneNumber).trim() ? String(phoneNumber).trim() : null;
    }
    if (trade !== undefined && trade !== null) {
      data.trade = String(trade).trim();
    }
    if (dailyWage !== undefined && dailyWage !== null && dailyWage !== "") {
      const parsedWage = parseFloat(String(dailyWage));
      if (!isNaN(parsedWage)) {
        data.dailyWage = parsedWage;
      }
    }
    if (isActive !== undefined && isActive !== null) {
      data.isActive = Boolean(isActive);
    }

    const updated = await prisma.worker.update({
      where: { id },
      data,
      include: {
        assignments: {
          include: {
            project: { select: { id: true, name: true, code: true, status: true } },
          },
        },
      },
    });

    // If projectId is provided, also ensure assignment
    if (projectId) {
      await prisma.workerAssignment.upsert({
        where: {
          workerId_projectId: {
            workerId: id,
            projectId,
          },
        },
        update: { assignedAt: new Date() },
        create: {
          workerId: id,
          projectId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Worker details updated successfully",
      worker: updated,
    });
  } catch (error: any) {
    console.error("Worker update error:", error);
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A worker with this National ID already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to update worker" },
      { status: 500 }
    );
  }
}

// DELETE /api/workers/[id] - Soft-deactivate or delete worker
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    const allowedRoles = ["HR_MANAGER", "GENERAL_MANAGER"];
    if (userRole && !allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden: Only HR Manager and General Manager can deactivate/remove workers." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";

    if (permanent) {
      await prisma.worker.delete({
        where: { id },
      });
      return NextResponse.json({
        success: true,
        message: "Worker permanently removed from the system",
      });
    }

    // Default: Soft delete / deactivate
    const updated = await prisma.worker.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Worker deactivated successfully",
      worker: updated,
    });
  } catch (error: any) {
    console.error("Worker delete error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete worker" },
      { status: 500 }
    );
  }
}
