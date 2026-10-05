import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const username = new URL(request.url).searchParams.get("username")?.trim();

    if (!username) {
        return NextResponse.json(
            { available: false, error: "Username is required" },
            { status: 400 },
        );
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: { username },
            select: { id: true },
        });

        return NextResponse.json({ available: existingUser === null });
    } catch (error) {
        console.error("Username availability check failed:", error);
        return NextResponse.json(
            { available: false, error: "Unable to check username availability" },
            { status: 500 },
        );
    }
}