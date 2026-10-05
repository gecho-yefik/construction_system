import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/attendances - Query attendance records
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const workerId = searchParams.get("workerId");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (workerId) where.workerId = workerId;
    if (dateStr) {
      const d = new Date(dateStr);
      where.date = {
        gte: new Date(d.setHours(0, 0, 0, 0)),
        lte: new Date(d.setHours(23, 59, 59, 999)),
      };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        worker: {
          select: { id: true, fullName: true, trade: true, dailyWage: true, phoneNumber: true },
        },
        project: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(attendances);
  } catch (error: any) {
    console.error("Attendances GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}

// POST /api/attendances - Record or batch update attendance
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Check if batch payload: { projectId, date, records: [{ workerId, status, hoursWorked }] }
    if (body.records && Array.isArray(body.records)) {
      const { projectId, date, records } = body;
      if (!projectId || !date) {
        return NextResponse.json(
          { error: "projectId and date are required for batch attendance" },
          { status: 400 }
        );
      }

      const targetDate = new Date(date);
      const results = [];

      for (const rec of records) {
        if (!rec.workerId) continue;
        const upserted = await prisma.attendance.upsert({
          where: {
            workerId_projectId_date: {
              workerId: rec.workerId,
              projectId: projectId,
              date: targetDate,
            },
          },
          update: {
            status: rec.status || "PRESENT",
            hoursWorked: rec.hoursWorked !== undefined ? parseFloat(rec.hoursWorked) : 8.0,
          },
          create: {
            workerId: rec.workerId,
            projectId: projectId,
            date: targetDate,
            status: rec.status || "PRESENT",
            hoursWorked: rec.hoursWorked !== undefined ? parseFloat(rec.hoursWorked) : 8.0,
          },
        });
        results.push(upserted);
      }

      return NextResponse.json({ message: "Attendance batch saved", count: results.length, data: results });
    }

    // Single attendance record
    const { workerId, projectId, date, status, hoursWorked } = body;
    if (!workerId || !projectId || !date) {
      return NextResponse.json(
        { error: "workerId, projectId, and date are required" },
        { status: 400 }
      );
    }

    const targetDate = new Date(date);
    const attendance = await prisma.attendance.upsert({
      where: {
        workerId_projectId_date: {
          workerId,
          projectId,
          date: targetDate,
        },
      },
      update: {
        status: status || "PRESENT",
        hoursWorked: hoursWorked !== undefined ? parseFloat(hoursWorked) : 8.0,
      },
      create: {
        workerId,
        projectId,
        date: targetDate,
        status: status || "PRESENT",
        hoursWorked: hoursWorked !== undefined ? parseFloat(hoursWorked) : 8.0,
      },
      include: {
        worker: { select: { id: true, fullName: true, trade: true } },
        project: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(attendance, { status: 201 });
  } catch (error: any) {
    console.error("Attendances POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to record attendance" },
      { status: 500 }
    );
  }
}
