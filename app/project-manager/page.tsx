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
  status: string;
  startDate: string;
  endDate: string | null;
  manager: { id: string; name: string | null; email: string | null; role: string } | null;
  _count: {
    tasks: number;
    documents: number;
    workforce: number;
    dailyReports: number;
    materialRequests: number;
  };
}

interface MaterialRequestItem {
  id: string;
  projectId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED";
  notes: string | null;
  createdAt: string;
  project: { id: string; name: string; code: string };
  requester: { id: string; name: string | null; email: string | null; role: string };
  approver?: { id: string; name: string | null; role: string } | null;
  items: Array<{
    id: string;
    quantityRequested: number;
    material: { id: string; name: string; unit: string; unitPrice: number };
  }>;
}

interface TaskItem {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
  startDate: string;
  dueDate: string;
  completedAt: string | null;
  project: { id: string; name: string; code: string };
}

interface DailyReportItem {
  id: string;
  projectId: string;
  date: string;
  workSummary: string;
  weatherCondition: string | null;
  issues: string | null;
  project: { id: string; name: string; code: string };
  engineer: { id: string; name: string | null; email: string | null; role: string };
}

interface WorkerAssignmentItem {
  id: string;
  assignedAt: string;
  project: { id: string; name: string; code: string };
  worker: {
    id: string;
    fullName: string;
    trade: string;
    dailyWage: number;
    phoneNumber: string | null;
    isActive: boolean;
  };
}

interface AttendanceItem {
  id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";
  hoursWorked: number;
  project: { id: string; name: string; code: string };
  worker: {
    id: string;
    fullName: string;
    trade: string;
  };
}

interface AiPredictionItem {
  id: string;
  predictionType: "COST_OVERRUN" | "SCHEDULE_DELAY" | "RESOURCE_FORECAST" | "RISK_ANALYSIS";
  predictedValue: number;
  confidence: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  insights: string;
  generatedAt: string;
  project: { id: string; name: string; code: string };
}

interface OverviewData {
  metrics: {
    assignedProjectsCount: number;
    pendingApprovalsCount: number;
    totalTasksCount: number;
    completedTasksCount: number;
    inProgressTasksCount: number;
    pendingTasksCount: number;
    dailyReportsCount: number;
    totalWorkforceCount: number;
    aiPredictionsCount: number;
  };
  assignedProjects: ProjectItem[];
  pendingRequests: MaterialRequestItem[];
  allRequests: MaterialRequestItem[];
  tasks: TaskItem[];
  recentReports: DailyReportItem[];
  workforce: WorkerAssignmentItem[];
  attendances: AttendanceItem[];
  aiPredictions: AiPredictionItem[];
}

export default function ProjectManagerModule() {
  const { data: session, status: authStatus } = useSession();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "approvals" | "tasks" | "projects" | "reports" | "workforce" | "ai"
  >("approvals");

  // Filter States
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("ALL");

  // Create Task Modal State
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    projectId: "",
    name: "",
    description: "",
    status: "PENDING",
    startDate: new Date().toISOString().split("T")[0],
    dueDate: "",
  });
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskError, setTaskError] = useState("");

  // Edit Task Modal State
  const [editTaskModalOpen, setEditTaskModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({
    name: "",
    description: "",
    status: "PENDING",
    dueDate: "",
  });
  const [editTaskSubmitting, setEditTaskSubmitting] = useState(false);
  const [editTaskError, setEditTaskError] = useState("");

  // Requisition Action State (Approve/Reject with Remarks)
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<MaterialRequestItem | null>(null);
  const [approvalActionType, setApprovalActionType] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  const userRole = (session?.user as { role?: string })?.role;
  const isAuthorized = userRole === "PROJECT_MANAGER" || userRole === "GENERAL_MANAGER";

  useEffect(() => {
    if (authStatus === "authenticated" && isAuthorized) {
      fetchOverview();
    } else if (authStatus !== "loading") {
      setLoading(false);
    }
  }, [authStatus, isAuthorized]);

  async function fetchOverview() {
    setLoading(true);
    try {
      const res = await fetch("/api/project-manager/overview");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.assignedProjects && json.assignedProjects.length > 0) {
          setTaskForm((prev) => ({
            ...prev,
            projectId: prev.projectId || json.assignedProjects[0].id,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load PM overview:", err);
    } finally {
      setLoading(false);
    }
  }

  // Open Task Modal with valid default project
  function openCreateTaskModal() {
    setTaskError("");
    if (data?.assignedProjects && data.assignedProjects.length > 0) {
      setTaskForm((prev) => ({
        ...prev,
        projectId: prev.projectId || data.assignedProjects[0].id,
      }));
    }
    setTaskModalOpen(true);
  }

  // Open Approval/Rejection Dialog
  function openApprovalDialog(req: MaterialRequestItem, action: "APPROVED" | "REJECTED") {
    setSelectedReq(req);
    setApprovalActionType(action);
    setApprovalRemarks(req.notes || "");
    setApprovalModalOpen(true);
  }

  // Submit Approval or Rejection
  async function handleSubmitApproval(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReq) return;

    setApprovalSubmitting(true);
    try {
      const res = await fetch(`/api/project-manager/material-requests/${selectedReq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: approvalActionType,
          notes: approvalRemarks.trim() || undefined,
        }),
      });

      if (res.ok) {
        setApprovalModalOpen(false);
        setSelectedReq(null);
        setApprovalRemarks("");
        fetchOverview();
      } else {
        const errJson = await res.json();
        alert(errJson.error || "Failed to update material request");
      }
    } catch (err) {
      console.error("Error submitting approval:", err);
    } finally {
      setApprovalSubmitting(false);
    }
  }

  // Create Task
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setTaskError("");

    const targetProjectId = taskForm.projectId || data?.assignedProjects?.[0]?.id;
    if (!targetProjectId) {
      setTaskError("Please select a project for this milestone.");
      return;
    }

    setTaskSubmitting(true);

    try {
      const res = await fetch("/api/project-manager/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...taskForm,
          projectId: targetProjectId,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        setTaskError(resJson.error || "Failed to create task");
        setTaskSubmitting(false);
        return;
      }

      setTaskModalOpen(false);
      setTaskForm({
        projectId: data?.assignedProjects?.[0]?.id || "",
        name: "",
        description: "",
        status: "PENDING",
        startDate: new Date().toISOString().split("T")[0],
        dueDate: "",
      });
      fetchOverview();
    } catch (err: any) {
      setTaskError(err?.message || "An error occurred");
    } finally {
      setTaskSubmitting(false);
    }
  }

  // Open Edit Task Modal
  function openEditTaskModal(task: TaskItem) {
    setSelectedTaskId(task.id);
    setEditTaskForm({
      name: task.name,
      description: task.description || "",
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
    });
    setEditTaskError("");
    setEditTaskModalOpen(true);
  }

  // Submit Edit Task
  async function handleUpdateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTaskId) return;

    setEditTaskSubmitting(true);
    setEditTaskError("");
    try {
      const res = await fetch(`/api/project-manager/tasks/${selectedTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editTaskForm),
      });

      const resJson = await res.json();
      if (!res.ok) {
        setEditTaskError(resJson.error || "Failed to update task");
        setEditTaskSubmitting(false);
        return;
      }

      setEditTaskModalOpen(false);
      fetchOverview();
    } catch (err: any) {
      setEditTaskError(err?.message || "Failed to update task");
    } finally {
      setEditTaskSubmitting(false);
    }
  }

  // Delete Task
  async function handleDeleteTask(taskId: string) {
    if (!confirm("Are you sure you want to remove this worksite milestone/task?")) return;

    try {
      const res = await fetch(`/api/project-manager/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchOverview();
      } else {
        alert("Failed to delete task");
      }
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  }

  // Fast Cycle Task Status
  async function handleCycleTaskStatus(taskId: string, currentStatus: string) {
    let nextStatus = "IN_PROGRESS";
    if (currentStatus === "PENDING") nextStatus = "IN_PROGRESS";
    else if (currentStatus === "IN_PROGRESS") nextStatus = "COMPLETED";
    else if (currentStatus === "COMPLETED") nextStatus = "PENDING";

    try {
      const res = await fetch(`/api/project-manager/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        fetchOverview();
      }
    } catch (err) {
      console.error("Error updating task status:", err);
    }
  }

  if (authStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-amber-400 font-semibold animate-pulse text-sm">
          Loading Project Manager Operational Hub...
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-3xl mb-4">
          👷
        </div>
        <h1 className="text-2xl font-extrabold text-white">Project Manager Access Restricted</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-md">
          This operational module is designed for <strong>Project Managers</strong> to oversee milestone schedules, daily site logs, workforce allocations, and approve material requisitions.
        </p>
        <p className="text-xs text-amber-400 mt-2">
          Your current role: <strong>{userRole || "User"}</strong>
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/projects"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors"
          >
            Explore Projects
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const m = data?.metrics;

  // Filtered Tasks
  const filteredTasks = (data?.tasks || []).filter((task) => {
    const matchProject = projectFilter === "ALL" || task.projectId === projectFilter;
    const matchStatus = taskStatusFilter === "ALL" || task.status === taskStatusFilter;
    return matchProject && matchStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Module Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/25 border border-amber-500/20 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-wider">
                  <span>👷</span>
                  <span>Operational Execution</span>
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Role: {userRole?.replace("_", " ")}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
                Project Manager Operations Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Execute project planning, coordinate worksite tasks &amp; milestones, approve material requests from Site Engineers, track site reports, and inspect AI cost &amp; delay forecasts.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="pm-add-task-btn"
                onClick={() => setTaskModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>Add Task / Milestone</span>
              </button>

              <Link
                href="/projects"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-700/80 transition-colors"
              >
                <span>Project Blueprints &amp; Files</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Operational Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Assigned Sites
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {m?.assignedProjectsCount || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Managed projects</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Pending Approvals
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-1">
              {m?.pendingApprovalsCount || 0}
            </div>
            <div className="text-[11px] text-amber-400/80 mt-1">
              {m?.pendingApprovalsCount ? "⚠️ Requires PM review" : "All requests approved"}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Milestones &amp; Tasks
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1">
              {m?.completedTasksCount || 0} / {m?.totalTasksCount || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {m?.inProgressTasksCount || 0} in progress &bull; {m?.pendingTasksCount || 0} pending
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Workforce Assigned
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {m?.totalWorkforceCount || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Site tradesmen &amp; staff</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md col-span-2 lg:col-span-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Site Daily Logs
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400 mt-1">
              {m?.dailyReportsCount || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Engineer field reports</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800">
          {[
            {
              id: "approvals",
              label: `Material Approvals (${m?.pendingApprovalsCount || 0})`,
              icon: "📦",
            },
            { id: "tasks", label: `Tasks & Milestones (${m?.totalTasksCount || 0})`, icon: "📋" },
            { id: "projects", label: "Assigned Projects & Files", icon: "🏗️" },
            { id: "workforce", label: `Workforce & Attendance (${m?.totalWorkforceCount || 0})`, icon: "👷" },
            { id: "reports", label: `Site Daily Reports (${m?.dailyReportsCount || 0})`, icon: "📝" },
            { id: "ai", label: "AI Forecasts & Delay Risk", icon: "🧠" },
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
        {/* TAB 1: MATERIAL REQUISITION APPROVALS */}
        {/* ============================================================ */}
        {activeTab === "approvals" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Procurement Chain of Custody
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  Material Requisitions Awaiting Project Manager Approval
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Review specifications and quantities requested by Site Engineers before issuance by Procurement Officers.
                </p>
              </div>
            </div>

            {(!data?.pendingRequests || data.pendingRequests.length === 0) ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 space-y-3">
                <span className="text-3xl">✅</span>
                <h4 className="text-sm font-bold text-white">No Pending Material Requests</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  All material requisitions have been reviewed. When Site Engineers submit new requests for your assigned projects, they will appear here for verification.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data?.pendingRequests?.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 rounded-2xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-all"
                  >
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-800 text-amber-400 border border-slate-700">
                          {req.project?.code}
                        </span>
                        <span className="text-xs font-bold text-white">
                          {req.project?.name}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                          Awaiting PM Approval
                        </span>
                      </div>

                      {/* Items requested */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                          Items &amp; Quantities:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {req.items?.map((item) => (
                            <div
                              key={item.id}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between"
                            >
                              <span className="text-slate-200 font-medium truncate">{item.material?.name}</span>
                              <span className="font-mono font-bold text-amber-400">
                                {item.quantityRequested} {item.material?.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {req.notes && (
                        <p className="text-xs text-slate-400 italic">
                          &quot;{req.notes}&quot;
                        </p>
                      )}

                      <div className="text-[10px] text-slate-500 flex items-center gap-3 pt-1">
                        <span>Requested by: <strong className="text-slate-300">{req.requester?.name || req.requester?.email || "Site Engineer"}</strong></span>
                        <span>&bull;</span>
                        <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Action Buttons for PM */}
                    <div className="flex items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                      <button
                        type="button"
                        onClick={() => openApprovalDialog(req, "APPROVED")}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Approve Request</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openApprovalDialog(req, "REJECTED")}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 transition-all cursor-pointer"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Historical Log */}
            {data?.allRequests && data.allRequests.length > 0 && (
              <div className="pt-8 border-t border-slate-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Recent Requisition History
                </h3>
                <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
                  {data.allRequests.map((r) => (
                    <div key={r.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-amber-400 font-bold">{r.project?.code}</span>
                          <span className="text-slate-300">{r.items?.map((i) => `${i.quantityRequested} ${i.material?.name}`).join(", ")}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(r.createdAt).toLocaleDateString()} &bull; Requester: {r.requester?.name || "Site Engineer"}
                          {r.approver?.name && ` &bull; Reviewed by: ${r.approver.name}`}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          r.status === "APPROVED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : r.status === "REJECTED"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: WORKSITE TASKS & MILESTONES */}
        {/* ============================================================ */}
        {activeTab === "tasks" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Site Scheduling &amp; Milestones
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  Worksite Tasks &amp; Schedule Management
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Define project tasks, track progress milestones, and cycle status (Pending &rarr; In Progress &rarr; Completed).
                </p>
              </div>

              <button
                type="button"
                onClick={openCreateTaskModal}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-md cursor-pointer"
              >
                + Add New Milestone
              </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Filter Project:</span>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">All Projects</option>
                  {data?.assignedProjects?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Status:</span>
                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="OVERDUE">Overdue</option>
                </select>
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 space-y-3">
                <span className="text-3xl">📋</span>
                <h4 className="text-sm font-bold text-white">No Tasks Match Filters</h4>
                <p className="text-xs text-slate-400">Click &quot;Add New Milestone&quot; above to schedule site activities.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 shadow-md flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
                          {task.project?.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            task.status === "COMPLETED"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              : task.status === "IN_PROGRESS"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white">{task.name}</h4>
                      {task.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3 pt-1">
                        <span>Due: <strong className="text-slate-300">{new Date(task.dueDate).toLocaleDateString()}</strong></span>
                        {task.completedAt && (
                          <span className="text-emerald-400">&bull; Completed on {new Date(task.completedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleCycleTaskStatus(task.id, task.status)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                      >
                        Status: <strong>{task.status === "COMPLETED" ? "Re-open" : "Advance Phase &rarr;"}</strong>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditTaskModal(task)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                          title="Edit Task"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                          title="Delete Task"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: ASSIGNED PROJECTS & BLUEPRINTS */}
        {/* ============================================================ */}
        {activeTab === "projects" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Projects Under Your Governance</h2>
                <p className="text-xs text-slate-400">
                  Track assigned construction portfolios, blueprint attachments, and budget limits.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateTaskModal}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-sm"
              >
                + Schedule Milestone
              </button>
            </div>

            {(!data?.assignedProjects || data.assignedProjects.length === 0) ? (
              <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-2xl">
                  🏗️
                </div>
                <h3 className="text-base font-bold text-white">No Projects Assigned Yet</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  The General Manager has not assigned any construction projects to your profile yet. Once a project is assigned, all site schedules, blueprints, material approvals, and daily reports will appear here automatically.
                </p>
                <div className="pt-2">
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <span>Browse Project Directory &rarr;</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.assignedProjects.map((p) => (
                  <div
                    key={p.id}
                    className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-amber-400">
                          {p.code}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {p.status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">{p.name}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2">{p.description || "No description provided."}</p>
                      
                      <div className="text-xs text-slate-400 space-y-1.5 pt-2 border-t border-slate-800">
                        <div className="flex justify-between">
                          <span>Location:</span>
                          <strong className="text-slate-200">{p.location}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Allocated Budget:</span>
                          <strong className="text-amber-400">${(p.budget || 0).toLocaleString()}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Supporting Documents:</span>
                          <strong className="text-white">{p._count?.documents || 0} files</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Scheduled Tasks:</span>
                          <strong className="text-emerald-400">{p._count?.tasks || 0} milestones</strong>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800">
                      <Link
                        href={`/projects/${p.id}`}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
                      >
                        <span>Open Files, Blueprints &amp; Site &rarr;</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: WORKFORCE & SITE ATTENDANCE */}
        {/* ============================================================ */}
        {activeTab === "workforce" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Workforce Deployment &amp; Supervision
              </span>
              <h2 className="text-xl font-bold text-white mt-1">
                Active Site Tradesmen &amp; Attendance Logs
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Supervise worker assignments across trades (Masons, Carpenters, Electricians) and review daily presence.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Assigned Tradesmen */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Assigned Workers ({data?.workforce?.length || 0})
                </h3>
                {(!data?.workforce || data.workforce.length === 0) ? (
                  <div className="p-6 text-center rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                    No workforce assigned yet to your managed sites.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden max-h-96 overflow-y-auto">
                    {data.workforce.map((item) => (
                      <div key={item.id} className="p-3.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{item.worker?.fullName}</span>
                            <span className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-amber-400 font-mono">
                              {item.worker?.trade}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            Site: {item.project?.code} &bull; Wage: ${item.worker?.dailyWage}/day
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attendance Logs */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Recent Site Attendance
                </h3>
                {(!data?.attendances || data.attendances.length === 0) ? (
                  <div className="p-6 text-center rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                    No attendance records logged yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden max-h-96 overflow-y-auto">
                    {data.attendances.map((att) => (
                      <div key={att.id} className="p-3.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white">{att.worker?.fullName} ({att.worker?.trade})</p>
                          <span className="text-[10px] text-slate-500">
                            {new Date(att.date).toLocaleDateString()} &bull; Site: {att.project?.code} &bull; {att.hoursWorked} hrs
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            att.status === "PRESENT"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : att.status === "ABSENT"
                              ? "bg-rose-500/10 text-rose-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {att.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: SITE DAILY PROGRESS REPORTS */}
        {/* ============================================================ */}
        {activeTab === "reports" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
            <h2 className="text-xl font-bold text-white">Daily Field Logs Submitted by Site Engineers</h2>
            <p className="text-xs text-slate-400">
              Review daily work activities, weather conditions, and site blockers recorded directly from the construction sites.
            </p>

            {(!data?.recentReports || data.recentReports.length === 0) ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/40 border border-slate-800/60">
                <p className="text-xs text-slate-400">No daily reports logged yet by Site Engineers.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentReports.map((report) => (
                  <div key={report.id} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-400 font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {report.project?.code}
                        </span>
                        <span className="font-bold text-white">{report.project?.name}</span>
                      </div>
                      <span className="text-slate-400 text-[11px]">{new Date(report.date).toLocaleDateString()}</span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed">{report.workSummary}</p>

                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {report.weatherCondition && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                          🌤️ Weather: {report.weatherCondition}
                        </span>
                      )}
                      {report.issues && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                          ⚠️ Issues: {report.issues}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-500 block pt-2 border-t border-slate-800/80">
                      Logged by Site Engineer: <strong className="text-slate-400">{report.engineer?.name || report.engineer?.email || "Engineer"}</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 6: AI PREDICTIONS & DECISION SUPPORT */}
        {/* ============================================================ */}
        {activeTab === "ai" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  AI Decision-Support System (Scenario 6)
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  Predictive Cost &amp; Schedule Intelligence
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Automated machine learning models evaluating site progress, budget variance, and resource consumption.
                </p>
              </div>
            </div>

            {data?.aiPredictions && data.aiPredictions.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {data.aiPredictions.map((pred) => (
                  <div key={pred.id} className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">{pred.predictionType.replace("_", " ")}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          pred.riskLevel === "LOW"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : pred.riskLevel === "MEDIUM"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {pred.riskLevel} RISK (${pred.predictedValue?.toLocaleString()})
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white">
                      Site: {pred.project?.name || pred.project?.code}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {pred.insights}
                    </p>
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800 flex justify-between">
                      <span>Model Confidence: <strong>{Math.round(pred.confidence * 100)}%</strong></span>
                      <span>{new Date(pred.generatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">COST OVERRUN FORECAST</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      LOW VARIANCE (+2.8%)
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Material Procurement Variance</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Historical material requisitions align with projected structural milestones. AI forecasts 97.2% budget compliance for the current quarterly cycle.
                  </p>
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                    Confidence: <strong>94.2%</strong> &bull; Scikit-learn Linear Regression
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">SCHEDULE DELAY RISK</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      MODERATE RISK (+4 Days)
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Weather &amp; Milestone Velocity</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Weather anomalies flagged in daily site reports may slow upper slab curing. AI advises pre-ordering reinforcement bars to prevent critical path delays.
                  </p>
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                    Confidence: <strong>89.7%</strong> &bull; Decision Tree Classifier
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: ADD TASK / MILESTONE */}
        {/* ============================================================ */}
        {taskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Project Manager Action
                  </span>
                  <h3 className="text-lg font-bold text-white">Add Worksite Task / Milestone</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {taskError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
                  {taskError}
                </div>
              )}

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Select Project *
                  </label>
                  <select
                    required
                    value={taskForm.projectId}
                    onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- Select Assigned Project --</option>
                    {data?.assignedProjects?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Task / Milestone Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Structural Framing & Column Rebar"
                    value={taskForm.name}
                    onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={taskForm.startDate}
                      onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Due Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Description / Scope
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Worksite scope, deliverables, and safety requirements..."
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setTaskModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={taskSubmitting}
                    className="px-6 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                  >
                    {taskSubmitting ? "Saving..." : "Save Milestone"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: EDIT TASK */}
        {/* ============================================================ */}
        {editTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Project Manager Action
                  </span>
                  <h3 className="text-lg font-bold text-white">Edit Task / Milestone</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditTaskModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {editTaskError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
                  {editTaskError}
                </div>
              )}

              <form onSubmit={handleUpdateTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Task Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editTaskForm.name}
                    onChange={(e) => setEditTaskForm({ ...editTaskForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Status
                    </label>
                    <select
                      value={editTaskForm.status}
                      onChange={(e) => setEditTaskForm({ ...editTaskForm, status: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="OVERDUE">Overdue</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editTaskForm.dueDate}
                      onChange={(e) => setEditTaskForm({ ...editTaskForm, dueDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={editTaskForm.description}
                    onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditTaskModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editTaskSubmitting}
                    className="px-6 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                  >
                    {editTaskSubmitting ? "Saving..." : "Update Milestone"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: APPROVE / REJECT REQUISITION WITH REMARKS */}
        {/* ============================================================ */}
        {approvalModalOpen && selectedReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Project Manager Verification
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  {approvalActionType === "APPROVED" ? "Approve Material Requisition" : "Reject Material Requisition"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Site: {selectedReq.project.code} &bull; Requester: {selectedReq.requester?.name || "Site Engineer"}
                </p>
              </div>

              <form onSubmit={handleSubmitApproval} className="space-y-4">
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-300">Requested Items:</span>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedReq.items.map((it) => (
                      <div key={it.id} className="p-2 rounded bg-slate-950 text-xs flex justify-between">
                        <span className="text-slate-200">{it.material.name}</span>
                        <span className="font-bold text-amber-400">{it.quantityRequested} {it.material.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {approvalActionType === "APPROVED" ? "Approval Remarks / Guidance (Optional)" : "Rejection Reason *"}
                  </label>
                  <textarea
                    rows={3}
                    required={approvalActionType === "REJECTED"}
                    placeholder={
                      approvalActionType === "APPROVED"
                        ? "e.g. Approved for Phase 1 structural pour..."
                        : "e.g. Excess quantity requested; please re-verify with site drawings..."
                    }
                    value={approvalRemarks}
                    onChange={(e) => setApprovalRemarks(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setApprovalModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={approvalSubmitting}
                    className={`px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 cursor-pointer disabled:opacity-50 ${
                      approvalActionType === "APPROVED"
                        ? "bg-emerald-400 hover:bg-emerald-300"
                        : "bg-rose-500 hover:bg-rose-400 text-white"
                    }`}
                  >
                    {approvalSubmitting
                      ? "Submitting..."
                      : approvalActionType === "APPROVED"
                      ? "Confirm Approval"
                      : "Confirm Rejection"}
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
