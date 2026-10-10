"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Project {
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
  _count: {
    documents: number;
    tasks: number;
    workforce: number;
    dailyReports: number;
    materialRequests: number;
    expenses: number;
  };
}

interface ManagerUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
}

export default function ProjectsPage() {
  const { data: session, status: authStatus } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [managers, setManagers] = useState<ManagerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    location: "",
    budget: "",
    status: "PLANNED",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    managerId: "",
  });

  const isGeneralManager = (session?.user as { role?: string })?.role === "GENERAL_MANAGER";

  useEffect(() => {
    fetchProjects();
    fetchManagers();
  }, [statusFilter]);

  async function fetchProjects() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (search) params.append("search", search);

      const res = await fetch(`/api/projects?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
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
      console.error("Failed to load managers:", err);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Failed to create project");
        setSubmitting(false);
        return;
      }

      setCreateModalOpen(false);
      setFormData({
        name: "",
        code: "",
        description: "",
        location: "",
        budget: "",
        status: "PLANNED",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        managerId: "",
      });
      fetchProjects();
    } catch (err: any) {
      setFormError(err?.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  const getStatusBadge = (status: Project["status"]) => {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "PLANNED":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "ON_HOLD":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "COMPLETED":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const totalBudget = projects.reduce((acc, p) => acc + (p.budget || 0), 0);
  const activeProjectsCount = projects.filter((p) => p.status === "IN_PROGRESS").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Enterprise Construction Intelligence
              </span>
              {isGeneralManager && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                  👑 General Manager Authorization
                </span>
              )}
              {(session?.user as { role?: string })?.role === "PROJECT_MANAGER" && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-400/15 text-blue-300 border border-blue-400/30">
                  Assigned Projects 
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
              Construction Projects
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Centralized project commissioning, budget controls, and engineering document management.
            </p>
          </div>

          {/* Action Area */}
          <div className="flex items-center gap-3">
            {isGeneralManager ? (
              <button
                type="button"
                id="create-project-btn"
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>New Project</span>
              </button>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                
                <span>Project updates &amp; creation: <strong>General Manager</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Executive Stats Banner */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Total Projects</span>
            <div className="text-2xl font-bold text-white mt-1">{projects.length}</div>
            <span className="text-[11px] text-amber-400">Registered sites</span>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Active Sites</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{activeProjectsCount}</div>
            <span className="text-[11px] text-slate-400">Under construction</span>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Portfolio Budget</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              ${totalBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[11px] text-slate-400">Allocated capital</span>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Project Documents</span>
            <div className="text-2xl font-bold text-white mt-1">
              {projects.reduce((acc, p) => acc + (p._count?.documents || 0), 0)}
            </div>
            <span className="text-[11px] text-slate-400">Blueprints &amp; contracts</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {["ALL", "PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="w-full sm:w-72 relative">
            <input
              type="text"
              placeholder="Search code, name, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchProjects()}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
            <svg
              className="w-4 h-4 text-slate-500 absolute left-3 top-2.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {/* Project Cards Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-64 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse p-6"></div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/30 border border-slate-800/60 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 flex items-center justify-center text-3xl">
              🏗️
            </div>
            <h3 className="text-lg font-bold text-white">No Projects Found</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {search
                ? `No projects match "${search}". Try clearing your search query.`
                : "No construction projects have been created yet."}
            </p>
            {isGeneralManager && (
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300"
              >
                <span>Commission First Project</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative flex flex-col justify-between p-6 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-amber-400/40 transition-all duration-200 shadow-md hover:shadow-xl hover:shadow-amber-500/5"
              >
                <div className="space-y-4">
                  {/* Card Header: Code & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-amber-400 border border-slate-700">
                      {project.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getStatusBadge(
                        project.status
                      )}`}
                    >
                      {project.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {project.description || "No project description provided."}
                    </p>
                  </div>

                  {/* Location & Budget */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                        Location
                      </span>
                      <p className="text-xs font-semibold text-slate-200 flex items-center gap-1 mt-0.5 truncate">
                        <span>📍</span>
                        <span className="truncate">{project.location}</span>
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                        Budget
                      </span>
                      <p className="text-xs font-bold text-amber-400 mt-0.5">
                        ${project.budget.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Manager & Timeline */}
                  <div className="text-xs space-y-1.5 pt-2 text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Project Manager:</span>
                      <span className="font-medium text-slate-300">
                        {project.manager?.name || "Unassigned"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Supporting Files:</span>
                      <span className="font-semibold text-amber-400 flex items-center gap-1">
                        <span>📎</span>
                        <span>{project._count?.documents || 0} attached</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-5 mt-4 border-t border-slate-800/80">
                  <Link
                    href={`/projects/${project.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-amber-400 hover:text-slate-950 border border-slate-700/80 hover:border-amber-400 transition-all duration-200"
                  >
                    <span>Manage Project &amp; Files</span>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create New Project (Only General Manager) */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    General Manager Privilege
                  </span>
                  <h2 className="text-xl font-bold text-white">Create New Construction Project</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Addis Commercial Tower"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Project Code * (Unique)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ACT-2026"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
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
                      placeholder="e.g. Bole Sub-city, Addis Ababa"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Total Allocated Budget ($ / ETB) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      placeholder="e.g. 5000000"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Initial Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="PLANNED">Planned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Target Completion Date
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assign Project Manager
                  </label>
                  <select
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">Select a manager (Optional)</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.email} ({m.role.replace("_", " ")})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Project Scope / Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter project objectives, structural specs, or key milestones..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
                  >
                    {submitting ? "Commissioning Project..." : "Commission Project"}
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
