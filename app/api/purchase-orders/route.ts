import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/purchase-orders - List purchase orders
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");
    const status = searchParams.get("status");

    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;

    const orders = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { orderedAt: "desc" },
      include: {
        supplier: { select: { id: true, name: true, phone: true, email: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, unit: true } },
          },
        },
        expenses: { select: { id: true, amount: true, projectId: true } },
      },
    });

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error("Purchase Orders GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch purchase orders" },
      { status: 500 }
    );
  }
}

// POST /api/purchase-orders - Create new purchase order
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { supplierId, items } = body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "supplierId and items array are required" },
        { status: 400 }
      );
    }

    // Calculate total amount
    const totalAmount = items.reduce((sum: number, it: any) => {
      const q = parseInt(String(it.quantity || 0));
      const p = parseFloat(String(it.unitPrice || 0));
      return sum + q * p;
    }, 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        supplierId,
        totalAmount,
        status: "PENDING",
        items: {
          create: items.map((it: any) => ({
            materialId: it.materialId,
            quantity: parseInt(String(it.quantity)),
            unitPrice: parseFloat(String(it.unitPrice)),
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });

    return NextResponse.json(po, { status: 201 });
  } catch (error: any) {
    console.error("Purchase Order POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create purchase order" },
      { status: 500 }
    );
  }
}
