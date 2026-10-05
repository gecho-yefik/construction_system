import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/material-issuances - List material issuances
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const where: any = {};
    if (projectId) where.projectId = projectId;

    const issuances = await prisma.materialIssuance.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      include: {
        project: { select: { id: true, name: true, code: true } },
        issuer: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, unit: true, unitPrice: true } },
          },
        },
      },
    });

    return NextResponse.json(issuances);
  } catch (error: any) {
    console.error("Material Issuances GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch issuances" },
      { status: 500 }
    );
  }
}

// POST /api/material-issuances - Record material issuance and decrement stock
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { projectId, issuedTo, items } = body;

    if (!projectId || !issuedTo || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "projectId, issuedTo, and items are required" },
        { status: 400 }
      );
    }

    // Execute in a transaction to guarantee stock deduction
    const issuance = await prisma.$transaction(async (tx) => {
      // Create issuance record
      const createdIssuance = await tx.materialIssuance.create({
        data: {
          projectId,
          issuedBy: userId,
          issuedTo: issuedTo.trim(),
          items: {
            create: items.map((it: { materialId: string; quantityIssued: number | string }) => ({
              materialId: it.materialId,
              quantityIssued: parseInt(String(it.quantityIssued)),
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

      // Deduct stock for each material
      for (const it of items) {
        const qty = parseInt(String(it.quantityIssued));
        await tx.material.update({
          where: { id: it.materialId },
          data: {
            quantity: {
              decrement: qty,
            },
          },
        });
      }

      return createdIssuance;
    });

    return NextResponse.json(issuance, { status: 201 });
  } catch (error: any) {
    console.error("Material Issuance POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to issue material" },
      { status: 500 }
    );
  }
}
