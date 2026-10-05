import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/expenses - List expenses with filters
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const category = searchParams.get("category");
    const limit = searchParams.get("limit");

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (category) where.category = category;

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { expenseDate: "desc" },
      take: limit ? parseInt(limit) : undefined,
      include: {
        project: { select: { id: true, name: true, code: true, budget: true } },
        recordedBy: { select: { id: true, name: true, role: true } },
        purchaseOrder: {
          select: {
            id: true,
            supplier: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json(expenses);
  } catch (error: any) {
    console.error("Expenses GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

// POST /api/expenses - Record a new project expense
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { projectId, category, amount, description, expenseDate } = body;

    if (!projectId || !category || amount === undefined) {
      return NextResponse.json(
        { error: "projectId, category, and amount are required" },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.create({
      data: {
        projectId,
        recordedById: userId,
        category,
        amount: parseFloat(amount),
        description: description ? description.trim() : null,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        recordedBy: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error: any) {
    console.error("Expenses POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to record expense" },
      { status: 500 }
    );
  }
}
