import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/workers - List workers with optional filters
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const trade = searchParams.get("trade");
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search");

    const where: any = {};

    if (isActive !== null && isActive !== undefined && isActive !== "") {
      where.isActive = isActive === "true";
    }

    if (trade) {
      where.trade = trade;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { nationalId: { contains: search, mode: "insensitive" } },
        { trade: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (projectId) {
      where.assignments = {
        some: { projectId },
      };
    }

    const workers = await prisma.worker.findMany({
      where,
      orderBy: { fullName: "asc" },
      include: {
        assignments: {
          include: {
            project: { select: { id: true, name: true, code: true, status: true } },
          },
        },
        _count: {
          select: {
            attendances: true,
            assignments: true,
          },
        },
      },
    });

    return NextResponse.json(workers);
  } catch (error: any) {
    console.error("Workers GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch workers" },
      { status: 500 }
    );
  }
}

// POST /api/workers - Register new worker
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fullName, nationalId, phoneNumber, trade, dailyWage, projectId } = body;

    if (!fullName || !trade || dailyWage === undefined) {
      return NextResponse.json(
        { error: "Full name, trade, and daily wage are required" },
        { status: 400 }
      );
    }

    const worker = await prisma.worker.create({
      data: {
        fullName: fullName.trim(),
        nationalId: nationalId ? nationalId.trim() : null,
        phoneNumber: phoneNumber ? phoneNumber.trim() : null,
        trade: trade.trim(),
        dailyWage: parseFloat(dailyWage),
        isActive: true,
        ...(projectId
          ? {
              assignments: {
                create: {
                  projectId,
                },
              },
            }
          : {}),
      },
      include: {
        assignments: {
          include: {
            project: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    return NextResponse.json(worker, { status: 201 });
  } catch (error: any) {
    console.error("Workers POST error:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A worker with this National ID already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to create worker" },
      { status: 500 }
    );
  }
}
