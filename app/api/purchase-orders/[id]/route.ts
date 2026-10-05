import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const { status, projectId } = body;

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true, supplier: true },
    });

    if (!existingPO) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const wasDelivered = existingPO.status === "DELIVERED";
    const isNowDelivered = status === "DELIVERED";

    const result = await prisma.$transaction(async (tx) => {
      const updatedPO = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status,
          receivedAt: isNowDelivered ? new Date() : existingPO.receivedAt,
        },
        include: {
          supplier: true,
          items: {
            include: { material: true },
          },
        },
      });

      // If transitioning to DELIVERED for the first time, increment inventory stock
      if (!wasDelivered && isNowDelivered) {
        for (const item of existingPO.items) {
          await tx.material.update({
            where: { id: item.materialId },
            data: {
              quantity: {
                increment: item.quantity,
              },
            },
          });
        }

        // If a projectId is provided or if a project exists, log the material procurement expense
        let targetProjectId = projectId;
        if (!targetProjectId) {
          const firstProject = await tx.project.findFirst({ select: { id: true } });
          targetProjectId = firstProject?.id;
        }

        if (targetProjectId) {
          await tx.expense.create({
            data: {
              projectId: targetProjectId,
              recordedById: session.user.id,
              purchaseOrderId: id,
              category: "MATERIALS",
              amount: existingPO.totalAmount,
              description: `Procurement PO delivery from ${existingPO.supplier.name}`,
              expenseDate: new Date(),
            },
          });
        }
      }

      return updatedPO;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Update PO error:", error);
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
    await prisma.purchaseOrder.delete({ where: { id } });
    return NextResponse.json({ message: "Purchase order deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
