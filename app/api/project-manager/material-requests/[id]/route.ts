import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/project-manager/material-requests/[id] - Approve or Reject request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    if (userRole !== "PROJECT_MANAGER" && userRole !== "GENERAL_MANAGER") {
      return NextResponse.json(
        { error: "Forbidden: Only Project Managers and General Managers can approve material requisitions." },
        { status: 403 }
      );
    }

    const { id: requestId } = await params;
    const userId = session.user.id;

    // Check request existence and project assignment
    const existingReq = await prisma.materialRequest.findUnique({
      where: { id: requestId },
      include: { project: { select: { managerId: true } } },
    });

    if (!existingReq) {
      return NextResponse.json({ error: "Material request not found" }, { status: 404 });
    }

    if (userRole === "PROJECT_MANAGER" && existingReq.project.managerId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You are only authorized to review material requests for your assigned project." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { status, notes } = body;

    if (!status || !["APPROVED", "REJECTED", "PENDING", "FULFILLED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be APPROVED, REJECTED, PENDING, or FULFILLED." },
        { status: 400 }
      );
    }

    const updatedRequest = await prisma.materialRequest.update({
      where: { id: requestId },
      data: {
        status,
        approvedBy: status === "APPROVED" || status === "REJECTED" ? session.user.id : undefined,
        ...(notes && { notes }),
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        requester: { select: { id: true, name: true, role: true } },
        approver: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            material: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Material requisition ${status.toLowerCase()} successfully.`,
      request: updatedRequest,
    });
  } catch (error: any) {
    console.error("Error approving/rejecting material request:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update material request status" },
      { status: 500 }
    );
  }
}
