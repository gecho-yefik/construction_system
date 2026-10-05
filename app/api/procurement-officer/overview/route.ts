import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      materials,
      suppliers,
      purchaseOrders,
      pendingRequests,
      recentIssuances,
      projects,
    ] = await Promise.all([
      prisma.material.findMany({
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
      }),
      prisma.supplier.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: { select: { purchaseOrders: true } },
        },
      }),
      prisma.purchaseOrder.findMany({
        orderBy: { orderedAt: "desc" },
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              material: { select: { id: true, name: true, unit: true } },
            },
          },
        },
      }),
      prisma.materialRequest.findMany({
        where: { status: { in: ["PENDING", "APPROVED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true, code: true } },
          requester: { select: { id: true, name: true, email: true } },
          approver: { select: { id: true, name: true } },
          items: {
            include: {
              material: { select: { id: true, name: true, unit: true, quantity: true } },
            },
          },
        },
      }),
      prisma.materialIssuance.findMany({
        orderBy: { issuedAt: "desc" },
        take: 10,
        include: {
          project: { select: { id: true, name: true, code: true } },
          issuer: { select: { id: true, name: true } },
          items: {
            include: {
              material: { select: { id: true, name: true, unit: true } },
            },
          },
        },
      }),
      prisma.project.findMany({
        where: { status: "IN_PROGRESS" },
        select: { id: true, name: true, code: true },
      }),
    ]);

    const lowStockItems = materials.filter((m) => m.quantity <= m.reorderLevel);
    const totalInventoryValue = materials.reduce(
      (sum, m) => sum + m.quantity * m.unitPrice,
      0
    );

    return NextResponse.json({
      metrics: {
        totalMaterials: materials.length,
        lowStockCount: lowStockItems.length,
        totalSuppliers: suppliers.length,
        activeOrdersCount: purchaseOrders.filter((p) => p.status === "PENDING" || p.status === "ORDERED").length,
        pendingRequisitionsCount: pendingRequests.length,
        totalInventoryValue: Math.round(totalInventoryValue),
      },
      lowStockItems,
      materials,
      suppliers,
      purchaseOrders,
      pendingRequests,
      recentIssuances,
      projects,
    });
  } catch (error: any) {
    console.error("Procurement overview error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load procurement overview" },
      { status: 500 }
    );
  }
}
