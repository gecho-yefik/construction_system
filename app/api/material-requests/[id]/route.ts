import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/material-requests/[id] - Approve / Reject / Fulfill
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, notes } = body;

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    const updated = await prisma.materialRequest.update({
      where: { id },
      data: {
        status,
        ...(status === "APPROVED" || status === "REJECTED" ? { approvedBy: session.user.id } : {}),
        ...(notes ? { notes: notes.trim() } : {}),
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        requester: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
