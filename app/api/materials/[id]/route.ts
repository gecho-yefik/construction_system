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
    const { name, unit, quantity, unitPrice, reorderLevel } = body;

    const updated = await prisma.material.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(unit ? { unit: unit.trim() } : {}),
        ...(quantity !== undefined ? { quantity: parseInt(quantity) } : {}),
        ...(unitPrice !== undefined ? { unitPrice: parseFloat(unitPrice) } : {}),
        ...(reorderLevel !== undefined ? { reorderLevel: parseInt(reorderLevel) } : {}),
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

    await prisma.material.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Material deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
