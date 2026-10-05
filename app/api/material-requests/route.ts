import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/material-requests - List material requests
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const requests = await prisma.materialRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true, code: true } },
        requester: { select: { id: true, name: true, email: true, role: true } },
        approver: { select: { id: true, name: true, email: true, role: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, unit: true, quantity: true, unitPrice: true } },
          },
        },
      },
    });

    return NextResponse.json(requests);
  } catch (error: any) {
    console.error("Material Requests GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch material requests" },
      { status: 500 }
    );
  }
}

// POST /api/material-requests - Submit new requisition
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { projectId, notes, items } = body;

    if (!projectId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "projectId and at least one material item are required" },
        { status: 400 }
      );
    }

    const request = await prisma.materialRequest.create({
      data: {
        projectId,
        requestedBy: userId,
        status: "PENDING",
        notes: notes ? notes.trim() : null,
        items: {
          create: items.map((it: { materialId: string; quantityRequested: number | string }) => ({
            materialId: it.materialId,
            quantityRequested: parseInt(String(it.quantityRequested)),
          })),
        },
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (error: any) {
    console.error("Material Request POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit material request" },
      { status: 500 }
    );
  }
}
