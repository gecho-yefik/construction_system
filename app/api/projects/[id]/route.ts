import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id] - Fetch single project with full details
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
    const userRole = (session.user as { role?: string })?.role;
    const userId = session.user.id;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true, role: true } },
        manager: { select: { id: true, name: true, email: true, role: true } },
        documents: {
          orderBy: { createdAt: "desc" },
          include: {
            uploader: { select: { id: true, name: true, role: true } },
          },
        },
        tasks: {
          orderBy: { dueDate: "asc" },
        },
        workforce: {
          include: {
            worker: true,
          },
        },
        expenses: {
          orderBy: { expenseDate: "desc" },
          take: 10,
        },
        dailyReports: {
          orderBy: { date: "desc" },
          take: 5,
        },
        _count: {
          select: {
            documents: true,
            tasks: true,
            workforce: true,
            attendances: true,
            dailyReports: true,
            materialRequests: true,
            expenses: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Role Enforcement: Project Managers are strictly limited to projects assigned to them
    if (userRole === "PROJECT_MANAGER" && project.managerId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You are only authorized to access projects assigned to you." },
        { status: 403 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

// PATCH /api/projects/[id] - Update project (RESTRICTED TO GENERAL_MANAGER ONLY)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role Enforcement: Per final project documentation:
    // Only the GENERAL_MANAGER can update project parameters, budget, assign project manager, and commission status.
    const userRole = (session.user as { role?: string }).role;
    if (userRole !== "GENERAL_MANAGER") {
      return NextResponse.json(
        {
          error: "Permission Denied: Only the General Manager is authorized to update project details, budget, and assignments.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { name, code, description, location, budget, status, startDate, endDate, managerId } = body;

    // Check project existence
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check code conflict if code is updated
    if (code && code.trim().toUpperCase() !== existing.code) {
      const duplicateCode = await prisma.project.findUnique({
        where: { code: code.trim().toUpperCase() },
      });
      if (duplicateCode) {
        return NextResponse.json(
          { error: `Project code '${code}' already belongs to another project.` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(code && { code: code.trim().toUpperCase() }),
        description: description !== undefined ? (description?.trim() || null) : undefined,
        ...(location && { location: location.trim() }),
        ...(budget !== undefined && { budget: parseFloat(budget) }),
        ...(status && { status }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(managerId !== undefined && { managerId: managerId || null }),
      },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        manager: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Project successfully updated by General Manager.",
      project: updated,
    });
  } catch (error: any) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete project (Only General Manager)
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
    if (userRole !== "GENERAL_MANAGER") {
      return NextResponse.json(
        {
          error: "Permission Denied: Only the General Manager can delete projects.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    await prisma.project.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Project deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete project" },
      { status: 500 }
    );
  }
}
