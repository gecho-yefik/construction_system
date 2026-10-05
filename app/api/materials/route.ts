import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/materials - List inventory stock
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lowStock = searchParams.get("lowStock");
    const search = searchParams.get("search");

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { unit: { contains: search, mode: "insensitive" } },
      ];
    }

    const materials = await prisma.material.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            requestItems: true,
            issuanceItems: true,
            purchaseItems: true,
          },
        },
      },
    });

    const enriched = materials.map((m) => ({
      ...m,
      isLowStock: m.quantity <= m.reorderLevel,
      totalStockValue: m.quantity * m.unitPrice,
    }));

    if (lowStock === "true") {
      return NextResponse.json(enriched.filter((m) => m.isLowStock));
    }

    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error("Materials GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch materials" },
      { status: 500 }
    );
  }
}

// POST /api/materials - Add new material item to catalog
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, unit, quantity, unitPrice, reorderLevel } = body;

    if (!name || !unit || unitPrice === undefined) {
      return NextResponse.json(
        { error: "Name, unit, and unit price are required" },
        { status: 400 }
      );
    }

    const material = await prisma.material.create({
      data: {
        name: name.trim(),
        unit: unit.trim(),
        quantity: quantity !== undefined ? parseInt(quantity) : 0,
        unitPrice: parseFloat(unitPrice),
        reorderLevel: reorderLevel !== undefined ? parseInt(reorderLevel) : 10,
      },
    });

    return NextResponse.json(material, { status: 201 });
  } catch (error: any) {
    console.error("Materials POST error:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A material with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to create material" },
      { status: 500 }
    );
  }
}
