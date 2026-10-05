import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/suppliers - List suppliers
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        purchaseOrders: {
          orderBy: { orderedAt: "desc" },
          take: 5,
        },
        _count: {
          select: { purchaseOrders: true },
        },
      },
    });

    return NextResponse.json(suppliers);
  } catch (error: any) {
    console.error("Suppliers GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch suppliers" },
      { status: 500 }
    );
  }
}

// POST /api/suppliers - Add new supplier
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, contactName, email, phone, address } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Supplier name and phone are required" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        contactName: contactName ? contactName.trim() : null,
        email: email ? email.trim() : null,
        phone: phone.trim(),
        address: address ? address.trim() : null,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error: any) {
    console.error("Suppliers POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create supplier" },
      { status: 500 }
    );
  }
}
