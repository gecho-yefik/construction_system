"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface ProjectItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  location: string;
  budget: number;
  status: "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  startDate: string;
  endDate: string | null;
  creator: { id: string; name: string | null; role: string };
  manager: { id: string; name: string | null; email: string | null; role: string } | null;
  _count: {
    documents: number;
    tasks: number;
    workforce: number;
    dailyReports: number;
    expenses: number;
  };
}

interface ManagerItem {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
}

interface ExpenseCategoryItem {
  category: string;
  totalAmount: number;
}

interface RecentExpenseItem {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  expenseDate: string;
  project: { id: string; name: string; code: string };
  recordedBy: { id: string; name: string | null; role: string };
}

interface DailyReportItem {
  id: string;
  date: string;
  workSummary: string;
  weatherCondition: string | null;
  issues: string | null;
  project: { id: string; name: string; code: string };
  engineer: { id: string; name: string | null; email: string | null; role: string };
}

interface OverviewData {
  metrics: {
    totalProjects: number;
    activeProjects: number;
    plannedProjects: number;
    completedProjects: number;
    totalBudget: number;
    totalExpenses: number;
    remainingBudget: number;
    budgetUtilization: number;
    totalWorkers: number;
    pendingMaterialRequests: number;
  };
  projects: ProjectItem[];
  managersList: ManagerItem[];
  expensesByCategory: ExpenseCategoryItem[];
  recentExpenses: RecentExpenseItem[];
  recentFieldReports: DailyReportItem[];
  aiPredictions: Array<{
    id: string;
    predictionType: string;
    predictedValue: number;
    confidence: number;
    riskLevel: string;
    insights: string;
    project: { name: string; code: string };
  }>;
}

export default function GeneralManagerModule() {
  const { data: session, status: authStatus } = useSession();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "projects" | "ai" | "team" | "financials" | "siteLogs"
  >("projects");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Project Creation Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
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
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  // Project Update Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
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
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const userRole = (session?.user as { role?: string })?.role;
  const isGeneralManager = userRole === "GENERAL_MANAGER";

  useEffect(() => {
    if (authStatus === "authenticated" && isGeneralManager) {
      fetchOverview();
    } else if (authStatus !== "loading") {
      setLoading(false);
    }
  }, [authStatus, isGeneralManager]);

  async function fetchOverview() {
    setLoading(true);
    try {
      const res = await fetch("/api/general-manager/overview");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load GM overview:", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle Commission Project
  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSubmitting(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const resData = await res.json();
      if (!res.ok) {
        setCreateError(resData.error || "Failed to commission project");
        setCreateSubmitting(false);
        return;
      }

      setCreateModalOpen(false);
      setCreateForm({
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
      fetchOverview();
    } catch (err: any) {
      setCreateError(err?.message || "Unexpected error");
    } finally {
      setCreateSubmitting(false);
    }
  }

  // Open Edit Modal for a Specific Project
  function openEditModal(project: ProjectItem) {
    setSelectedProjectId(project.id);
    setEditForm({
      name: project.name,
      code: project.code,
      description: project.description || "",
      location: project.location,
      budget: project.budget.toString(),
      status: project.status,
      startDate: project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "",
      endDate: project.endDate ? new Date(project.endDate).toISOString().split("T")[0] : "",
      managerId: project.manager?.id || "",
    });
    setEditError("");
    setEditSuccess("");
    setEditModalOpen(true);
  }

  // Handle Update Project (Only GM)
  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) return;

    setEditError("");
    setEditSuccess("");
    setEditSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const resData = await res.json();
      if (!res.ok) {
        setEditError(resData.error || "Failed to update project");
        setEditSubmitting(false);
        return;
      }

      setEditSuccess("Project updated successfully by General Manager!");
      setTimeout(() => {
        setEditModalOpen(false);
        setEditSuccess("");
      }, 1000);
      fetchOverview();
    } catch (err: any) {
      setEditError(err?.message || "Error updating project");
    } finally {
      setEditSubmitting(false);
    }
  }

  // Handle Delete Project
  async function handleDeleteProject(projectId: string, projectName: string) {
    if (
      !confirm(
        `Are you sure you want to delete '${projectName}'? All attached tasks, daily reports, and workforce records will be removed.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchOverview();
      } else {
        const errJson = await res.json();
        alert(errJson.error || "Failed to delete project");
      }
    } catch (err) {
      console.error("Error deleting project:", err);
    }
  }

  if (authStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-amber-400 font-semibold animate-pulse text-sm">
          Loading General Manager Governance Module...
        </div>
      </div>
    );
  }

  // Role Gate: Access Restricted
  if (!isGeneralManager) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-3xl mb-4">
          🔒
        </div>
        <h1 className="text-2xl font-extrabold text-white">General Manager Access Restricted</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-md">
          This module is reserved exclusively for the <strong>General Manager</strong> to oversee project commissioning, capital budget allocations, and Project Manager delegations as defined in system governance.
        </p>
        <p className="text-xs text-amber-400 mt-2">
          Your current role: <strong>{userRole || "User"}</strong>
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/projects"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors"
          >
            Go to Projects Hub
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800"
          >
            Home Overview
          </Link>
        </div>
      </div>
    );
  }

  const m = data?.metrics;

  // Filtered Projects
  const filteredProjects = (data?.projects || []).filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Module Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/20 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-wider">
                  <span>👑</span>
                  <span>Executive Governance Module</span>
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Role: General Manager
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
                General Manager Control Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Supreme executive authority for project commissioning, capital budget authorizations, Project Manager delegations, financial audits, and AI-driven cost &amp; delay forecasts.
              </p>
            </div>

            {/* Quick Executive Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="gm-new-project-btn"
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>Commission New Project</span>
              </button>

              <Link
                href="/projects"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 transition-colors"
              >
                <span>View Public Hub</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Executive KPI Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Portfolio Budget
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              ${m?.totalBudget ? m.totalBudget.toLocaleString() : "0"}
            </div>
            <div className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
              <span>●</span>
              <span>Across {m?.totalProjects || 0} registered projects</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Recorded Expenditures
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-1">
              ${m?.totalExpenses ? m.totalExpenses.toLocaleString() : "0"}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {m?.budgetUtilization || 0}% budget utilized &bull; ${m?.remainingBudget ? m.remainingBudget.toLocaleString() : "0"} free
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Active Project Sites
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1">
              {m?.activeProjects || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {m?.plannedProjects || 0} planned &bull; {m?.completedProjects || 0} finished
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Workforce Deployment
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {m?.totalWorkers || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Active site operatives across trades
            </div>
          </div>
        </div>

        {/* Navigation Tabs within GM Module */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800">
          {[
            { id: "projects", label: `Project Portfolios (${data?.projects.length || 0})`, icon: "🏗️" },
            { id: "financials", label: "Budget & Financial Audit", icon: "📊" },
            { id: "ai", label: "AI Forecasts & Risk Alerts", icon: "🧠" },
            { id: "team", label: `Leadership Directory (${data?.managersList.length || 0})`, icon: "👷" },
            { id: "siteLogs", label: "Site Daily Reports", icon: "📝" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-amber-400 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ============================================================ */}
        {/* TAB 1: PROJECT GOVERNANCE & UPDATES */}
        {/* ============================================================ */}
        {activeTab === "projects" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Project Portfolios Under Executive Oversight</h2>
                <p className="text-xs text-slate-400">
                  General Managers hold the exclusive authority to commission projects, adjust budget baselines, and delegate Project Managers.
                </p>
              </div>

              {/* Search & Status Filters */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PLANNED">Planned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((p) => (
                <div
                  key={p.id}
                  className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-amber-500/40 shadow-xl flex flex-col justify-between space-y-5 transition-all group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-amber-400 border border-slate-700">
                        {p.code}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                        {p.status.replace("_", " ")}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {p.description || "No description provided."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase">Allocated Budget</span>
                        <p className="font-bold text-amber-400 mt-0.5">
                          ${p.budget.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase">Project Manager</span>
                        <p className="font-semibold text-slate-300 truncate mt-0.5">
                          {p.manager?.name || "Unassigned"}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
                      <span>Supporting Files:</span>
                      <span className="font-bold text-white">{p._count.documents} attached</span>
                    </div>
                  </div>

                  {/* Actions for GM */}
                  <div className="space-y-2 pt-4 border-t border-slate-800">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-400 hover:text-slate-950 bg-amber-400/10 hover:bg-amber-400 border border-amber-400/30 transition-all cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Update Project</span>
                      </button>

                      <Link
                        href={`/projects/${p.id}`}
                        className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                      >
                        <span>Files &amp; Details &rarr;</span>
                      </Link>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteProject(p.id, p.name)}
                      className="w-full text-center py-1 text-[11px] text-rose-400/70 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      Delete Project
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: FINANCIAL & PROCUREMENT AUDIT (Scenario 5) */}
        {/* ============================================================ */}
        {activeTab === "financials" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Financial Audit &amp; Cost Control (Scenario 5)
              </span>
              <h2 className="text-xl font-bold text-white mt-1">
                Executive Capital &amp; Expenditure Breakdown
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Portfolio expenditure variance compared against allocated project capital across operational categories.
              </p>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Capital Allocated</span>
                <p className="text-2xl font-bold text-white mt-1">${m?.totalBudget.toLocaleString()}</p>
                <span className="text-[11px] text-slate-400 mt-1 block">Approved project financing</span>
              </div>
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Expenses Incurred</span>
                <p className="text-2xl font-bold text-amber-400 mt-1">${m?.totalExpenses.toLocaleString()}</p>
                <span className="text-[11px] text-amber-400/80 mt-1 block">{m?.budgetUtilization}% utilized</span>
              </div>
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Available Liquidity</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">${m?.remainingBudget.toLocaleString()}</p>
                <span className="text-[11px] text-emerald-400/80 mt-1 block">Uncommitted capital balance</span>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="grid lg:grid-cols-2 gap-6 pt-4">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-300">
                  Expenditure by Category
                </h3>
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  {data?.expensesByCategory.length === 0 ? (
                    <p className="text-xs text-slate-400">No recorded expenses yet.</p>
                  ) : (
                    data?.expensesByCategory.map((cat) => {
                      const pct = m?.totalExpenses ? Math.round((cat.totalAmount / m.totalExpenses) * 100) : 0;
                      return (
                        <div key={cat.category} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-200">{cat.category}</span>
                            <span className="font-mono text-amber-400 font-bold">
                              ${cat.totalAmount.toLocaleString()} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Recent Financial Transactions */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-300">
                  Recent Expense Logs (Recorded by Accountants)
                </h3>
                <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden max-h-80 overflow-y-auto">
                  {data?.recentExpenses.length === 0 ? (
                    <div className="p-4 text-xs text-slate-400">No recent transactions.</div>
                  ) : (
                    data?.recentExpenses.map((exp) => (
                      <div key={exp.id} className="p-3.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-amber-400 font-bold">{exp.project.code}</span>
                            <span className="font-semibold text-white">{exp.category}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{exp.description || "General expenditure"}</p>
                          <span className="text-[10px] text-slate-500">
                            {new Date(exp.expenseDate).toLocaleDateString()} &bull; By: {exp.recordedBy.name || "Accountant"}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          ${exp.amount.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: AI FORECASTS & RISK ALERTS (Scenario 6) */}
        {/* ============================================================ */}
        {activeTab === "ai" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Machine Learning &amp; Risk Intelligence (Scenario 6)
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  Predictive Construction Insights &amp; Decision Support
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Automated cost overrun projections, schedule delay detection, and resource optimization algorithms.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">COST OVERRUN PREDICTION</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    LOW RISK (0.12)
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">Debre Berhan University Innovation Complex</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Project expenditure variance is within +3.4% of scheduled budget baseline. Material requisition velocity matches structural phase milestones.
                </p>
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                  Model Confidence: <strong>94.2%</strong> &bull; Scikit-learn Linear Regression Model
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">SCHEDULE DELAY FORECAST</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    MEDIUM RISK (+5 Days)
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">Weather &amp; Logistics Impact</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Heavy rain recorded in daily reports may impact concrete curing time on upper slab. AI recommends expediting rebar fabrication.
                </p>
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                  Model Confidence: <strong>89.7%</strong> &bull; Decision Tree Classifier
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: MANAGEMENT TEAM & DELEGATIONS */}
        {/* ============================================================ */}
        {activeTab === "team" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Engineering &amp; Operations Leadership Directory</h2>
              <p className="text-xs text-slate-400 mt-1">
                Project Managers, Site Engineers, and Key Officers available for delegation and project assignments.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {data?.managersList.map((user) => (
                <div key={user.id} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-400/10 text-amber-400 font-bold flex items-center justify-center text-sm">
                      {user.name ? user.name[0].toUpperCase() : "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{user.name || "User"}</h4>
                      <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                      {user.role.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: SITE DAILY REPORTS (Scenario 7) */}
        {/* ============================================================ */}
        {activeTab === "siteLogs" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Site Progress Audit (Scenario 7)
              </span>
              <h2 className="text-xl font-bold text-white mt-1">
                Organization-Wide Site Daily Reports
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Field progress summaries, weather impediments, and blocker logs submitted by Site Engineers.
              </p>
            </div>

            {data?.recentFieldReports.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                No site reports recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {data?.recentFieldReports.map((rep) => (
                  <div key={rep.id} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-400 font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {rep.project.code}
                        </span>
                        <span className="font-bold text-white">{rep.project.name}</span>
                      </div>
                      <span className="text-slate-400">{new Date(rep.date).toLocaleDateString()}</span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed">{rep.workSummary}</p>

                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {rep.weatherCondition && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                          🌤️ Weather: {rep.weatherCondition}
                        </span>
                      )}
                      {rep.issues && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                          ⚠️ Blockers: {rep.issues}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-500 block pt-2 border-t border-slate-800">
                      Logged by Site Engineer: <strong className="text-slate-400">{rep.engineer?.name || rep.engineer?.email}</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: COMMISSION NEW PROJECT */}
        {/* ============================================================ */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Executive Commissioning
                  </span>
                  <h2 className="text-xl font-bold text-white">Commission New Construction Project</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
                  {createError}
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
                      placeholder="e.g. Bole Commercial Tower"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
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
                      placeholder="e.g. BCT-01"
                      value={createForm.code}
                      onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
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
                      placeholder="e.g. Addis Ababa, Bole"
                      value={createForm.location}
                      onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
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
                      placeholder="e.g. 10000000"
                      value={createForm.budget}
                      onChange={(e) => setCreateForm({ ...createForm, budget: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Initial Status
                    </label>
                    <select
                      value={createForm.status}
                      onChange={(e) => setCreateForm({ ...createForm, status: e.target.value as any })}
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
                      value={createForm.startDate}
                      onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Target Completion
                    </label>
                    <input
                      type="date"
                      value={createForm.endDate}
                      onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assign Project Manager
                  </label>
                  <select
                    value={createForm.managerId}
                    onChange={(e) => setCreateForm({ ...createForm, managerId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">Unassigned</option>
                    {data?.managersList.map((m) => (
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
                    placeholder="Enter project specifications and goals..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="px-6 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 cursor-pointer"
                  >
                    {createSubmitting ? "Commissioning..." : "Commission Project"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: UPDATE PROJECT (ONLY GENERAL MANAGER) */}
        {/* ============================================================ */}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    General Manager Privilege
                  </span>
                  <h2 className="text-xl font-bold text-white">Update Construction Project</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {editError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
                  {editSuccess}
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
                      Allocated Budget ($ / ETB) *
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
                      Target Completion
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
                    {data?.managersList.map((m) => (
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
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="px-6 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 cursor-pointer"
                  >
                    {editSubmitting ? "Saving..." : "Save Project Changes"}
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
