import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects - List all projects
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
        manager: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: {
            documents: true,
            tasks: true,
            workforce: true,
            dailyReports: true,
            materialRequests: true,
            expenses: true,
          },
        },
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

// POST /api/projects - Create project (Only General Manager)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role Enforcement: Per final project documentation, only GENERAL_MANAGER creates/authorizes projects
    const userRole = (session.user as { role?: string }).role;
    if (userRole !== "GENERAL_MANAGER") {
      return NextResponse.json(
        {
          error: "Permission Denied: Only the General Manager is authorized to create and commission new projects.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, code, description, location, budget, status, startDate, endDate, managerId } = body;

    if (!name || !code || !location || budget === undefined || !startDate) {
      return NextResponse.json(
        { error: "Missing required fields (name, code, location, budget, startDate)" },
        { status: 400 }
      );
    }

    // Verify code uniqueness
    const existing = await prisma.project.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Project code '${code}' already exists. Please choose a unique code.` },
        { status: 409 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description?.trim() || null,
        location: location.trim(),
        budget: parseFloat(budget),
        status: status || "PLANNED",
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        creatorId: session.user.id,
        managerId: managerId || null,
      },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        manager: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create project" },
      { status: 500 }
    );
  }
}
