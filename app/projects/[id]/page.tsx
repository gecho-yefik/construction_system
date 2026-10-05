"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface DocumentItem {
  id: string;
  projectId: string;
  uploaderId: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: "BLUEPRINT" | "CONTRACT" | "PERMIT" | "SPECIFICATION" | "BOQ_ESTIMATE" | "SITE_PHOTO" | "INVOICE_RECEIPT" | "OTHER";
  description: string | null;
  createdAt: string;
  uploader: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  };
}

interface ProjectDetails {
  id: string;
  name: string;
  code: string;
  description: string | null;
  location: string;
  budget: number;
  status: "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  startDate: string;
  endDate: string | null;
  creator: { id: string; name: string | null; email: string | null; role: string };
  manager: { id: string; name: string | null; email: string | null; role: string } | null;
  documents: DocumentItem[];
  tasks: Array<{ id: string; name: string; status: string; dueDate: string }>;
  _count: {
    documents: number;
    tasks: number;
    workforce: number;
    dailyReports: number;
  };
}

interface ManagerUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();

  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [managers, setManagers] = useState<ManagerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // General Manager Edit Project Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    description: "",
    location: "",
    budget: "",
    status: "PLANNED",
    startDate: "",
    endDate: "",
    managerId: "",
  });
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");

  // Document Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>("BLUEPRINT");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const userRole = (session?.user as { role?: string })?.role;
  const isGeneralManager = userRole === "GENERAL_MANAGER";

  useEffect(() => {
    fetchProject();
    fetchManagers();
  }, [id]);

  async function fetchProject() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        if (data.project) {
          setEditForm({
            name: data.project.name || "",
            code: data.project.code || "",
            description: data.project.description || "",
            location: data.project.location || "",
            budget: data.project.budget?.toString() || "",
            status: data.project.status || "PLANNED",
            startDate: data.project.startDate
              ? new Date(data.project.startDate).toISOString().split("T")[0]
              : "",
            endDate: data.project.endDate
              ? new Date(data.project.endDate).toISOString().split("T")[0]
              : "",
            managerId: data.project.manager?.id || "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to load project details:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchManagers() {
    try {
      const res = await fetch("/api/users/managers");
      if (res.ok) {
        const data = await res.json();
        setManagers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch managers:", err);
    }
  }

  // Update Project (Restricted to GENERAL_MANAGER)
  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();
    setUpdateError("");
    setUpdateSuccess("");
    setUpdating(true);

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setUpdateError(data.error || "Failed to update project");
        setUpdating(false);
        return;
      }

      setUpdateSuccess("Project updated successfully by General Manager!");
      setTimeout(() => {
        setEditModalOpen(false);
        setUpdateSuccess("");
      }, 1200);
      fetchProject();
    } catch (err: any) {
      setUpdateError(err?.message || "An error occurred");
    } finally {
      setUpdating(false);
    }
  }

  // Upload Supporting Document
  async function handleUploadDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;

    setUploadError("");
    setUploadSuccess("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("category", uploadCategory);
      formData.append("description", uploadDescription);

      const res = await fetch(`/api/projects/${id}/documents`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "Failed to upload document");
        setUploading(false);
        return;
      }

      setUploadSuccess("Supporting file attached successfully!");
      setUploadFile(null);
      setUploadDescription("");
      // Reset file input element
      const fileInput = document.getElementById("project-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      fetchProject();
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Delete Document
  async function handleDeleteDocument(docId: string) {
    if (!confirm("Are you sure you want to delete this supporting file?")) return;

    try {
      const res = await fetch(`/api/projects/${id}/documents/${docId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchProject();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete document");
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "BLUEPRINT":
        return "📐";
      case "CONTRACT":
        return "📜";
      case "PERMIT":
        return "🛡️";
      case "SPECIFICATION":
        return "📋";
      case "BOQ_ESTIMATE":
        return "📊";
      case "SITE_PHOTO":
        return "📷";
      case "INVOICE_RECEIPT":
        return "🧾";
      default:
        return "📎";
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "BLUEPRINT":
        return "Architectural Blueprint";
      case "CONTRACT":
        return "Legal Contract";
      case "PERMIT":
        return "Building Permit";
      case "SPECIFICATION":
        return "Technical Spec";
      case "BOQ_ESTIMATE":
        return "BOQ & Cost Estimate";
      case "SITE_PHOTO":
        return "Site Progress Photo";
      case "INVOICE_RECEIPT":
        return "Invoice / Receipt";
      default:
        return "General Document";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-amber-400 font-semibold animate-pulse text-sm">
          Loading project data &amp; blueprint repository...
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold">Project Not Found</h2>
        <p className="text-sm text-slate-400 mt-2">The requested construction project does not exist.</p>
        <Link href="/projects" className="mt-4 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-semibold text-xs">
          Return to Projects Hub
        </Link>
      </div>
    );
  }

  const filteredDocuments = project.documents?.filter((doc) => {
    if (selectedCategory === "ALL") return true;
    return doc.category === selectedCategory;
  }) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/projects" className="hover:text-amber-400 transition-colors">
            Projects
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-mono font-semibold">{project.code}</span>
        </div>

        {/* Project Header Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-slate-800 text-amber-400 border border-slate-700">
                  {project.code}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {project.status.replace("_", " ")}
                </span>
                {isGeneralManager && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    👑 General Manager Authorized
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {project.name}
              </h1>
              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                {project.description || "No project description provided."}
              </p>
            </div>

            {/* General Manager Update Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {isGeneralManager ? (
                <button
                  type="button"
                  id="open-update-project-btn"
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>Update Project</span>
                </button>
              ) : (
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                  <span>🔒</span>
                  <span>Project updates restricted to <strong>General Manager</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-800/80">
            <div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Site Location
              </span>
              <p className="text-xs font-semibold text-white mt-1 flex items-center gap-1 truncate">
                <span>📍</span>
                <span>{project.location}</span>
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Allocated Budget
              </span>
              <p className="text-sm font-bold text-amber-400 mt-1">
                ${project.budget?.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Project Manager
              </span>
              <p className="text-xs font-semibold text-slate-200 mt-1">
                {project.manager?.name || "Not assigned"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Project Schedule
              </span>
              <p className="text-xs font-semibold text-slate-300 mt-1">
                {new Date(project.startDate).toLocaleDateString()}
                {project.endDate ? ` → ${new Date(project.endDate).toLocaleDateString()}` : " (Open)"}
              </p>
            </div>
          </div>
        </div>

        {/* SUPPORTING FILES & DOCUMENTS SECTION (UPLOAD FILE TO SUPPORT PROJECT) */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Engineering Repository
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {project.documents?.length || 0} files attached
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Supporting Files &amp; Project Documents
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Upload and organize blueprints, contracts, permits, specifications, BOQ sheets, and site photos.
              </p>
            </div>
          </div>

          {/* Upload Form Box */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>📤</span>
              <span>Upload Supporting File to Project</span>
            </h3>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
                {uploadSuccess}
              </div>
            )}

            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Select File (PDF, DWG, CAD, JPG, PNG, XLSX, DOCX) *
                  </label>
                  <input
                    id="project-file-input"
                    type="file"
                    required
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-400 file:text-slate-950 hover:file:bg-amber-300 cursor-pointer bg-slate-900 border border-slate-800 rounded-xl"
                  />
                  {uploadFile && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Document Category *
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="BLUEPRINT">📐 Architectural / Engineering Blueprint</option>
                    <option value="CONTRACT">📜 Legal Contract / Agreement</option>
                    <option value="PERMIT">🛡️ Building / Construction Permit</option>
                    <option value="SPECIFICATION">📋 Material &amp; Technical Specification</option>
                    <option value="BOQ_ESTIMATE">📊 Bill of Quantities (BOQ) / Cost Estimate</option>
                    <option value="SITE_PHOTO">📷 Site Progress Photo</option>
                    <option value="INVOICE_RECEIPT">🧾 Invoice / Material Receipt</option>
                    <option value="OTHER">📎 Other Support Document</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Description / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ground floor structural drawing revision 3 approved by lead architect"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                  <span>{uploading ? "Uploading File..." : "Attach File to Project"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {[
              { id: "ALL", label: "All Files" },
              { id: "BLUEPRINT", label: "Blueprints" },
              { id: "CONTRACT", label: "Contracts" },
              { id: "PERMIT", label: "Permits" },
              { id: "SPECIFICATION", label: "Specifications" },
              { id: "BOQ_ESTIMATE", label: "BOQ & Estimates" },
              { id: "SITE_PHOTO", label: "Site Photos" },
              { id: "OTHER", label: "Other" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === tab.id
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Supporting Documents List */}
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 space-y-3">
              <span className="text-3xl">📂</span>
              <p className="text-xs text-slate-400">
                {selectedCategory === "ALL"
                  ? "No supporting files have been uploaded for this project yet. Use the upload box above to attach blueprints and documents."
                  : `No files found under category "${selectedCategory}".`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocuments.map((doc) => {
                const canDelete = isGeneralManager || doc.uploaderId === session?.user?.id;
                return (
                  <div
                    key={doc.id}
                    className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 flex flex-col justify-between space-y-3 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xl shrink-0">
                        {getCategoryIcon(doc.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                            {getCategoryLabel(doc.category)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {formatFileSize(doc.fileSize)}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white mt-1 truncate" title={doc.name}>
                          {doc.name}
                        </h4>
                        {doc.description && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                            {doc.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-2">
                          <span>Uploaded by: <strong className="text-slate-300">{doc.uploader?.name || "User"}</strong></span>
                          <span>&bull;</span>
                          <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        <span>View / Download</span>
                      </a>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                          title="Delete file"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL: UPDATE PROJECT (ONLY GENERAL MANAGER) */}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    General Manager Exclusive Action
                  </span>
                  <h2 className="text-xl font-bold text-white">Update Construction Project</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                >
                  ✕
                </button>
              </div>

              {updateError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
                  {updateError}
                </div>
              )}
              {updateSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
                  {updateSuccess}
                </div>
              )}

              <form onSubmit={handleUpdateProject} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Project Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.code}
                      onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Site Location *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Budget ($ / ETB) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={editForm.budget}
                      onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Status
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="PLANNED">Planned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Completion Date
                    </label>
                    <input
                      type="date"
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assign Project Manager
                  </label>
                  <select
                    value={editForm.managerId}
                    onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">Unassigned</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.email} ({m.role.replace("_", " ")})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Project Description
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-6 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
                  >
                    {updating ? "Saving Changes..." : "Save Project Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
