import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// GET /api/projects/[id]/documents - List supporting files for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const documents = await prisma.projectDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        uploader: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Error fetching project documents:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

// POST /api/projects/[id]/documents - Upload supporting file for a project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Check project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "OTHER";
    const description = (formData.get("description") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided for upload" }, { status: 400 });
    }

    // Limit file size (50MB maximum)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 50MB maximum limit." },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Prepare upload directory: public/uploads/projects/[projectId]
    const relativeDir = path.join("uploads", "projects", projectId);
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);
    await mkdir(absoluteDir, { recursive: true });

    // Generate safe unique filename
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFileName = `${timestamp}_${cleanFileName}`;
    const absoluteFilePath = path.join(absoluteDir, uniqueFileName);

    // Save to disk
    await writeFile(absoluteFilePath, buffer);

    // Web accessible URL
    const fileUrl = `/uploads/projects/${projectId}/${uniqueFileName}`;

    // Valid category validation
    const validCategories = [
      "BLUEPRINT",
      "CONTRACT",
      "PERMIT",
      "SPECIFICATION",
      "BOQ_ESTIMATE",
      "SITE_PHOTO",
      "INVOICE_RECEIPT",
      "OTHER",
    ];
    const safeCategory = validCategories.includes(category) ? category : "OTHER";

    // Save record to Prisma
    const document = await prisma.projectDocument.create({
      data: {
        projectId,
        uploaderId: session.user.id,
        name: file.name,
        fileUrl,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        category: safeCategory as any,
        description: description.trim() || null,
      },
      include: {
        uploader: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Supporting document uploaded successfully.",
        document,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error uploading project document:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload document" },
      { status: 500 }
    );
  }
}
