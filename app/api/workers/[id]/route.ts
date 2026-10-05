import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

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
            project: { select: { id: true, name: true, code: true, status: true } },
          },
        },
        attendances: {
          orderBy: { date: "desc" },
          take: 30,
          include: {
            project: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    return NextResponse.json(worker);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}

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
    const { fullName, nationalId, phoneNumber, trade, dailyWage, isActive } = body;

    const updated = await prisma.worker.update({
      where: { id },
      data: {
        ...(fullName ? { fullName: fullName.trim() } : {}),
        ...(nationalId !== undefined ? { nationalId: nationalId ? nationalId.trim() : null } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber: phoneNumber ? phoneNumber.trim() : null } : {}),
        ...(trade ? { trade: trade.trim() } : {}),
        ...(dailyWage !== undefined ? { dailyWage: parseFloat(dailyWage) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Soft delete / deactivate
    const updated = await prisma.worker.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Worker deactivated", worker: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
