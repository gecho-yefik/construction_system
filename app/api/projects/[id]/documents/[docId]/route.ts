import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

// DELETE /api/projects/[id]/documents/[docId] - Delete a supporting document
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, docId } = await params;
    const document = await prisma.projectDocument.findUnique({
      where: { id: docId },
    });

    if (!document || document.projectId !== projectId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const userRole = (session.user as { role?: string }).role;
    const isUploader = document.uploaderId === session.user.id;
    const isGeneralManager = userRole === "GENERAL_MANAGER";

    if (!isUploader && !isGeneralManager) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to delete this document." },
        { status: 403 }
      );
    }

    // Try deleting physical file from disk
    try {
      const diskPath = path.join(process.cwd(), "public", document.fileUrl);
      await unlink(diskPath);
    } catch (fsErr) {
      console.warn("Could not delete physical file from disk (may already be deleted):", fsErr);
    }

    // Delete record from Prisma
    await prisma.projectDocument.delete({ where: { id: docId } });

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete document" },
      { status: 500 }
    );
  }
}
