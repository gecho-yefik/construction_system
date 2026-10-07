"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

// Types
interface FormattedProject {
  id: string;
  name: string;
  code: string;
  location: string;
  description: string | null;
  manager: string;
  status: "Completed" | "In Progress" | "To Do";
  progress: number;
  endDate: string;
  startDate: string;
  budget: number;
  spent: number;
  remaining: number;
  spentPercentage: number;
  tasksCount: number;
  completedTasksCount: number;
  reportsCount: number;
  workforceCount: number;
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
  completedAt?: string | null;
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

interface MaterialItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  reorderLevel: number;
}

interface PurchaseOrderItem {
  id: string;
  totalAmount: number;
  status: string;
  orderedAt: string;
  supplier: { name: string; phone: string };
  items: Array<{
    quantity: number;
    material: { name: string; unit: string };
  }>;
}

interface ExpenseItem {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  expenseDate: string;
  project: { id: string; name: string; code: string };
  recordedBy: { name: string | null };
}

interface ActivityItem {
  id: string;
  title: string;
  time: string;
  type: "project" | "request" | "order" | "user" | "payment" | "report";
  read?: boolean;
}

interface PMOverviewData {
  metrics: {
    totalProjects: number;
    completedProjects: number;
    inProgressProjects: number;
    todoProjects: number;
    completedPercentage: number;
    inProgressPercentage: number;
    todoPercentage: number;
    assignedProjectsCount: number;
    pendingApprovalsCount: number;
    totalTasksCount: number;
    completedTasksCount: number;
    inProgressTasksCount: number;
    pendingTasksCount: number;
    taskCompletionRate: number;
    dailyReportsCount: number;
    totalWorkforce: number;
    totalExpenses: number;
    totalBudget: number;
    remainingBudget: number;
    spentPercentage: number;
    remainingPercentage: number;
    laborExpenses: number;
    procurementExpenses: number;
    otherExpenses: number;
    totalSuppliers: number;
    totalMaterials: number;
    lowStockMaterialsCount: number;
    totalPurchaseOrders: number;
    materialRequestsCount: number;
  };
  projects: FormattedProject[];
  assignedProjects: any[];
  pendingRequests: MaterialRequestItem[];
  allRequests: MaterialRequestItem[];
  tasks: TaskItem[];
  recentReports: DailyReportItem[];
  workforce: WorkerAssignmentItem[];
  attendances: AttendanceItem[];
  materials: MaterialItem[];
  purchaseOrders: PurchaseOrderItem[];
  expenses: ExpenseItem[];
  activities: ActivityItem[];
}

export default function ProjectManagerDashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "projects" | "tasks" | "approvals" | "reports" | "budget" | "workforce" | "materials" | "procurement"
  >("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("ALL");
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("ALL");

  // Requisition Action State
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<MaterialRequestItem | null>(null);
  const [approvalActionType, setApprovalActionType] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  // Task Modal State
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

  // Main Dashboard Data
  const [data, setData] = useState<PMOverviewData>({
    metrics: {
      totalProjects: 0,
      completedProjects: 0,
      inProgressProjects: 0,
      todoProjects: 0,
      completedPercentage: 0,
      inProgressPercentage: 0,
      todoPercentage: 0,
      assignedProjectsCount: 0,
      pendingApprovalsCount: 0,
      totalTasksCount: 0,
      completedTasksCount: 0,
      inProgressTasksCount: 0,
      pendingTasksCount: 0,
      taskCompletionRate: 0,
      dailyReportsCount: 0,
      totalWorkforce: 0,
      totalExpenses: 0,
      totalBudget: 0,
      remainingBudget: 0,
      spentPercentage: 0,
      remainingPercentage: 0,
      laborExpenses: 0,
      procurementExpenses: 0,
      otherExpenses: 0,
      totalSuppliers: 0,
      totalMaterials: 0,
      lowStockMaterialsCount: 0,
      totalPurchaseOrders: 0,
      materialRequestsCount: 0,
    },
    projects: [],
    assignedProjects: [],
    pendingRequests: [],
    allRequests: [],
    tasks: [],
    recentReports: [],
    workforce: [],
    attendances: [],
    materials: [],
    purchaseOrders: [],
    expenses: [],
    activities: [],
  });

  // Fetch overview data
  const fetchOverview = async () => {
    try {
      const res = await fetch("/api/project-manager/overview");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.assignedProjects && json.assignedProjects.length > 0 && !taskForm.projectId) {
          setTaskForm((prev) => ({ ...prev, projectId: json.assignedProjects[0].id }));
        }
      }
    } catch (err) {
      console.error("Failed to load PM overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(2)}M`;
    }
    if (amount >= 1_000) {
      return `$${(amount / 1_000).toFixed(1)}k`;
    }
    return `$${amount.toLocaleString()}`;
  };

  // Requisitions handler
  function openApprovalDialog(req: MaterialRequestItem, action: "APPROVED" | "REJECTED") {
    setSelectedReq(req);
    setApprovalActionType(action);
    setApprovalRemarks(req.notes || "");
    setApprovalModalOpen(true);
  }

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

  // Create Task / Milestone
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
        setTaskError(resJson.error || "Failed to create milestone");
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

  // Fast cycle task status
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

  // Edit Task
  function openEditTaskModal(task: TaskItem) {
    setSelectedTaskId(task.id);
    setEditTaskForm({
      name: task.name,
      description: task.description || "",
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
    });
    setEditTaskModalOpen(true);
  }

  async function handleUpdateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTaskId) return;

    setEditTaskSubmitting(true);
    try {
      const res = await fetch(`/api/project-manager/tasks/${selectedTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editTaskForm),
      });

      if (res.ok) {
        setEditTaskModalOpen(false);
        fetchOverview();
      } else {
        const resJson = await res.json();
        alert(resJson.error || "Failed to update task");
      }
    } catch (err) {
      console.error("Failed to update task:", err);
    } finally {
      setEditTaskSubmitting(false);
    }
  }

  // Filter projects by search
  const displayedProjects = data.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter tasks
  const displayedTasks = data.tasks.filter((t) => {
    const matchesProject = selectedProjectFilter === "ALL" || t.projectId === selectedProjectFilter;
    const matchesStatus = taskStatusFilter === "ALL" || t.status === taskStatusFilter;
    return matchesProject && matchesStatus;
  });

  // Sidebar Menu Items
  const menuItems = [
    { id: "dashboard", name: "Dashboard & Summary", icon: "dashboard" },
    { id: "projects", name: "Assigned Projects", icon: "projects" },
    { id: "tasks", name: "Tasks & Milestones", icon: "tasks", badge: data.metrics.pendingTasksCount },
    { id: "approvals", name: "Material Requests", icon: "procurement", badge: data.metrics.pendingApprovalsCount },
    { id: "reports", name: "Site Daily Reports", icon: "reports", badge: data.metrics.dailyReportsCount },
    { id: "budget", name: "Budget & Costs", icon: "financials" },
    { id: "workforce", name: "Workforce & Attendance", icon: "workforce" },
    { id: "materials", name: "Materials Inventory", icon: "materials" },
    { id: "procurement", name: "Procurement Orders", icon: "suppliers" },
  ];

  const renderSidebarIcon = (iconName: string) => {
    switch (iconName) {
      case "dashboard":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
          </svg>
        );
      case "projects":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      case "tasks":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case "suppliers":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        );
      case "materials":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      case "procurement":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case "workforce":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case "financials":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "reports":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
          </svg>
        );
    }
  };

  // Donut chart calculations
  const totalCircumference = 238.76;
  const completedDash = (data.metrics.completedPercentage / 100) * totalCircumference;
  const inProgressDash = (data.metrics.inProgressPercentage / 100) * totalCircumference;
  const todoDash = (data.metrics.todoPercentage / 100) * totalCircumference;

  return (
    <div className="min-h-screen flex bg-[#F4F6F9] font-sans antialiased text-[#2D3748]">
      {/* -------------------- LEFT SIDEBAR -------------------- */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } transition-all duration-300 bg-[#0B132B] text-slate-300 flex flex-col justify-between shrink-0 shadow-2xl z-30 min-h-screen sticky top-0 h-screen`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo & Brand */}
          <div className="px-5 py-5 flex items-center justify-between border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18" />
                  <path d="M5 21V7l8-4v18" />
                  <path d="M19 21V11l-6-4" />
                  <path d="M9 9v.01" />
                  <path d="M9 13v.01" />
                  <path d="M9 17v.01" />
                </svg>
              </div>
              {sidebarOpen && (
                <div className="flex flex-col">
                  <span className="text-lg font-extrabold tracking-tight text-white leading-tight">
                    BuildMaster
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                    CONSTRUCTION SYSTEM
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-white p-1 rounded-md"
              title="Toggle sidebar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* PM User Profile Card */}
          <div className="px-4 py-3 border-b border-slate-800/60">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "P"}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0B132B] rounded-full"></span>
              </div>
              {sidebarOpen && (
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold text-white truncate">
                    {session?.user?.name || "Project Manager"}
                  </span>
                  <span className="text-[10px] text-amber-400 font-medium truncate">
                    Project Manager
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Menu Items List */}
          <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 group relative ${
                    isActive
                      ? "bg-[#2563EB] text-white shadow-md shadow-blue-600/30"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  }`}
                >
                  <span className={`shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}>
                    {renderSidebarIcon(item.icon)}
                  </span>
                  {sidebarOpen && (
                    <span className="flex-1 text-left truncate">{item.name}</span>
                  )}
                  {sidebarOpen && Boolean(item.badge && item.badge > 0) && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Logout */}
          <div className="p-3 border-t border-slate-800/80">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* -------------------- MAIN CONTENT AREA -------------------- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <main className="p-6 sm:p-8 space-y-7 max-w-[1600px] mx-auto w-full">
          {/* TAB 1: MAIN DASHBOARD & SUMMARY */}
          {activeTab === "dashboard" && (
            <>
              {/* Top Action & Welcome Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-800">
                    Project Manager Overview &amp; Site Progress
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time project tracking, milestone schedules, material requisitions &amp; budget controls.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setTaskError("");
                      setTaskModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>+ New Milestone</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("approvals")}
                    className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold transition"
                  >
                    <span>Requisitions ({data.metrics.pendingApprovalsCount})</span>
                  </button>
                </div>
              </div>

              {/* ROW 1: 6 TOP STAT METRIC CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5">
                {/* 1. Total Projects */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Assigned Projects
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.totalProjects}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("projects")} className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-blue-600 font-medium hover:underline text-left">
                    <span>View portfolio</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                {/* 2. Completed Projects */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Completed Projects
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.completedProjects}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-emerald-600 font-medium">
                    <span>{data.metrics.completedPercentage}% of total</span>
                    <span>&uarr;</span>
                  </div>
                </div>

                {/* 3. In Progress Projects */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        In Progress
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.inProgressProjects}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-amber-600 font-medium">
                    <span>{data.metrics.inProgressPercentage}% of total</span>
                    <span>&uarr;</span>
                  </div>
                </div>

                {/* 4. Active Tasks / Milestones */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Total Milestones
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.totalTasksCount}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("tasks")} className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-purple-600 font-medium hover:underline text-left">
                    <span>{data.metrics.completedTasksCount} completed ({data.metrics.taskCompletionRate}%)</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                {/* 5. Pending Approvals */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Pending Approvals
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.pendingApprovalsCount}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("approvals")}
                    className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-sky-600 font-medium hover:underline text-left"
                  >
                    <span>Review requests</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                {/* 6. Total Budget & Expenses */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Total Expenses
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {formatCurrency(data.metrics.totalExpenses)}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("budget")} className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-teal-600 font-medium hover:underline text-left">
                    <span>Budget: {formatCurrency(data.metrics.totalBudget)}</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>

              {/* ROW 2: PROJECTS OVERVIEW & MILESTONE PERFORMANCE */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
                {/* Left: Projects Overview Card */}
                <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-xs border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Projects Progress &amp; Performance</h2>
                      <p className="text-[11px] text-slate-400">Status, task completions, and scheduled end dates</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("projects")}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                      View All Projects
                    </button>
                  </div>

                  {/* Card Body: Donut Chart & Table */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6 items-center">
                    {/* Donut Chart */}
                    <div className="md:col-span-4 flex flex-col items-center justify-center p-2">
                      <div className="relative w-36 h-36 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="38" stroke="#F1F5F9" strokeWidth="12" fill="none" />
                          {data.metrics.totalProjects > 0 ? (
                            <>
                              {completedDash > 0 && (
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="38"
                                  stroke="#10B981"
                                  strokeWidth="12"
                                  strokeDasharray={`${completedDash} ${totalCircumference}`}
                                  strokeDashoffset="0"
                                  fill="none"
                                  strokeLinecap="round"
                                />
                              )}
                              {inProgressDash > 0 && (
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="38"
                                  stroke="#F59E0B"
                                  strokeWidth="12"
                                  strokeDasharray={`${inProgressDash} ${totalCircumference}`}
                                  strokeDashoffset={`-${completedDash}`}
                                  fill="none"
                                  strokeLinecap="round"
                                />
                              )}
                              {todoDash > 0 && (
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="38"
                                  stroke="#8B5CF6"
                                  strokeWidth="12"
                                  strokeDasharray={`${todoDash} ${totalCircumference}`}
                                  strokeDashoffset={`-${completedDash + inProgressDash}`}
                                  fill="none"
                                  strokeLinecap="round"
                                />
                              )}
                            </>
                          ) : (
                            <circle cx="50" cy="50" r="38" stroke="#CBD5E1" strokeWidth="12" fill="none" />
                          )}
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center text-center">
                          <span className="text-2xl font-extrabold text-slate-800 leading-none">
                            {data.metrics.totalProjects}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">Total</span>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2 text-xs w-full max-w-[200px]">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            <span>Completed</span>
                          </span>
                          <span className="font-semibold text-slate-700">
                            {data.metrics.completedProjects} ({data.metrics.completedPercentage}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            <span>In Progress</span>
                          </span>
                          <span className="font-semibold text-slate-700">
                            {data.metrics.inProgressProjects} ({data.metrics.inProgressPercentage}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                            <span>To Do / Planned</span>
                          </span>
                          <span className="font-semibold text-slate-700">
                            {data.metrics.todoProjects} ({data.metrics.todoPercentage}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="md:col-span-8 overflow-x-auto">
                      {displayedProjects.length === 0 ? (
                        <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            📁
                          </div>
                          <p className="text-xs font-semibold text-slate-700">No project records found</p>
                          <p className="text-[11px] text-slate-400 max-w-xs">
                            Assigned projects under your management will appear here.
                          </p>
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-semibold">
                            <tr>
                              <th className="pb-3 pr-4 font-semibold">Project</th>
                              <th className="pb-3 px-3 font-semibold">Status</th>
                              <th className="pb-3 px-3 font-semibold">Progress</th>
                              <th className="pb-3 px-3 font-semibold">Budget Used</th>
                              <th className="pb-3 pl-3 font-semibold">Target End</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {displayedProjects.slice(0, 5).map((proj) => {
                              let badgeColor = "bg-purple-50 text-purple-600 border border-purple-200/50";
                              if (proj.status === "Completed") {
                                badgeColor = "bg-emerald-50 text-emerald-600 border border-emerald-200/50";
                              } else if (proj.status === "In Progress") {
                                badgeColor = "bg-amber-50 text-amber-600 border border-amber-200/50";
                              }

                              return (
                                <tr key={proj.id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-3.5 pr-4 font-semibold text-slate-800 whitespace-nowrap">
                                    <div>
                                      <span className="font-semibold">{proj.name}</span>
                                      <span className="text-[10px] text-slate-400 block">{proj.code} &bull; {proj.location}</span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3 whitespace-nowrap">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${badgeColor}`}>
                                      {proj.status}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-3 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-medium w-8 text-slate-700">
                                        {proj.progress}%
                                      </span>
                                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className="bg-emerald-500 h-1.5 rounded-full transition-all"
                                          style={{ width: `${proj.progress}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3 whitespace-nowrap font-medium text-slate-700">
                                    {formatCurrency(proj.spent)} / {formatCurrency(proj.budget)}
                                  </td>
                                  <td className="py-3.5 pl-3 text-slate-500 whitespace-nowrap">
                                    {proj.endDate}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Milestone Performance & Progress Monitoring Card */}
                <div className="lg:col-span-4 bg-white rounded-2xl p-6 shadow-xs border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-800">Milestone Schedule &amp; Execution</h2>
                    <button
                      onClick={() => setActiveTab("tasks")}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      View All
                    </button>
                  </div>

                  <div className="space-y-4 my-auto py-3">
                    {/* Completion Summary Box */}
                    <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Task Completion Rate</span>
                        <span className="text-sm font-extrabold text-blue-600">{data.metrics.taskCompletionRate}%</span>
                      </div>
                      <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${data.metrics.taskCompletionRate}%` }}
                        ></div>
                      </div>
                      <div className="grid grid-cols-3 text-center pt-2 text-[11px]">
                        <div>
                          <span className="font-extrabold text-slate-800 block">{data.metrics.completedTasksCount}</span>
                          <span className="text-slate-400">Done</span>
                        </div>
                        <div>
                          <span className="font-extrabold text-amber-600 block">{data.metrics.inProgressTasksCount}</span>
                          <span className="text-slate-400">In Progress</span>
                        </div>
                        <div>
                          <span className="font-extrabold text-purple-600 block">{data.metrics.pendingTasksCount}</span>
                          <span className="text-slate-400">Pending</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Upcoming Tasks Preview */}
                    <div className="space-y-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Recent Milestones
                      </span>
                      {data.tasks.slice(0, 3).map((t) => (
                        <div key={t.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                            <span className="text-[10px] text-slate-400">{t.project.name} &bull; Due: {new Date(t.dueDate).toLocaleDateString()}</span>
                          </div>
                          <button
                            onClick={() => handleCycleTaskStatus(t.id, t.status)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              t.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-700"
                                : t.status === "IN_PROGRESS"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {t.status.replace("_", " ")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ROW 3: SECONDARY STAT MINI-CARDS (4 cards) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. Materials in Stock */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Materials Catalog
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.totalMaterials}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("materials")} className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-emerald-600 font-medium hover:underline text-left">
                    <span>{data.metrics.lowStockMaterialsCount > 0 ? `${data.metrics.lowStockMaterialsCount} low stock alerts` : "All stock optimal"}</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                {/* 2. Material Requests */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Material Requests
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.materialRequestsCount}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("approvals")}
                    className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-amber-600 font-medium hover:underline text-left"
                  >
                    <span>{data.metrics.pendingApprovalsCount} pending review</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                {/* 3. Site Daily Reports */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Engineer Reports
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.dailyReportsCount}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("reports")} className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-indigo-600 font-medium hover:underline text-left">
                    <span>View site logs</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                {/* 4. Total Workforce */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Assigned Workforce
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.totalWorkforce}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("workforce")}
                    className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-rose-600 font-medium hover:underline text-left"
                  >
                    <span>View trades &amp; roster</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>

              {/* ROW 4: BUDGET & COST COMPARISON, EXPENSE BREAKDOWN & RECENT ACTIVITIES */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
                {/* 1. Planned Budget vs Actual Cost Overview */}
                <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800">Planned Budget vs Actual Cost</h3>
                    <button onClick={() => setActiveTab("budget")} className="text-[11px] font-semibold text-blue-600 hover:underline">
                      Details
                    </button>
                  </div>

                  <div className="my-2">
                    <span className="text-2xl font-black text-slate-900 block">
                      {formatCurrency(data.metrics.totalBudget)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Total Project Budget Committed</span>
                  </div>

                  <div className="space-y-4 my-auto">
                    {/* Spent */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-700">
                          {formatCurrency(data.metrics.totalExpenses)}{" "}
                          <span className="font-normal text-slate-400">Total Spent</span>
                        </span>
                        <span className="text-slate-600">{data.metrics.spentPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, data.metrics.spentPercentage)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Remaining */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-700">
                          {formatCurrency(data.metrics.remainingBudget)}{" "}
                          <span className="font-normal text-slate-400">Remaining</span>
                        </span>
                        <span className="text-slate-600">{data.metrics.remainingPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, data.metrics.remainingPercentage)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Expenditure Category Breakdown (Labor vs Procurement) */}
                <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800">Cost Category Distribution</h3>
                    <span className="text-[11px] text-slate-400 font-medium">Labor &amp; Materials</span>
                  </div>

                  <div className="space-y-3 my-auto py-2">
                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Labor &amp; Wages</span>
                          <span className="text-[10px] text-slate-400">On-site trades &amp; contractors</span>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-800">
                        {formatCurrency(data.metrics.laborExpenses)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Materials &amp; Procurement</span>
                          <span className="text-[10px] text-slate-400">Supplies, cement, rebar, tools</span>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-800">
                        {formatCurrency(data.metrics.procurementExpenses)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Equipment &amp; Other</span>
                          <span className="text-[10px] text-slate-400">Plant hire, logistics &amp; site ops</span>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-800">
                        {formatCurrency(data.metrics.otherExpenses)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Recent Activity Log */}
                <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800">Recent Project Activity</h3>
                    <span className="text-[11px] font-semibold text-blue-600">Live Log</span>
                  </div>

                  <div className="space-y-3 my-auto py-2">
                    {data.activities.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No recent actions logged</p>
                    ) : (
                      data.activities.slice(0, 4).map((act) => {
                        let iconBg = "bg-blue-50 text-blue-600";
                        if (act.type === "request") iconBg = "bg-amber-50 text-amber-600";
                        if (act.type === "report") iconBg = "bg-emerald-50 text-emerald-600";

                        return (
                          <div key={act.id} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <p className="text-slate-700 font-medium truncate">{act.title}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{act.time}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: ASSIGNED PROJECTS & PLANNING */}
          {activeTab === "projects" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Assigned Projects &amp; Planning Portfolio</h2>
                    <p className="text-xs text-slate-500">Review project schedules, budgets, location scope and task milestones</p>
                  </div>
                  <button
                    onClick={() => {
                      setTaskError("");
                      setTaskModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow transition"
                  >
                    + Add Project Milestone
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                  {data.projects.map((proj) => (
                    <div key={proj.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm">{proj.name}</h3>
                            <span className="text-[11px] text-slate-400 block">{proj.code} &bull; 📍 {proj.location}</span>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            proj.status === "Completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : proj.status === "In Progress"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {proj.status}
                          </span>
                        </div>
                        {proj.description && (
                          <p className="text-xs text-slate-500 line-clamp-2">{proj.description}</p>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-600">Work Progress</span>
                          <span className="text-slate-800">{proj.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-2 rounded-full transition-all"
                            style={{ width: `${proj.progress}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Budget comparison */}
                      <div className="p-3 bg-white rounded-xl border border-slate-100 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Committed Budget:</span>
                          <span className="font-bold text-slate-800">{formatCurrency(proj.budget)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Recorded Expenses:</span>
                          <span className="font-bold text-rose-600">{formatCurrency(proj.spent)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Remaining Balance:</span>
                          <span className="font-bold text-emerald-600">{formatCurrency(proj.remaining)}</span>
                        </div>
                      </div>

                      {/* Footer stats */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>Tasks: {proj.completedTasksCount}/{proj.tasksCount}</span>
                        <span>Workers: {proj.workforceCount}</span>
                        <span>Reports: {proj.reportsCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TASKS & MILESTONES */}
          {activeTab === "tasks" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Tasks, Schedules &amp; Milestones</h2>
                    <p className="text-xs text-slate-500">Plan and manage milestone execution schedules across your assigned worksites</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedProjectFilter}
                      onChange={(e) => setSelectedProjectFilter(e.target.value)}
                      className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="ALL">All Projects</option>
                      {data.assignedProjects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        setTaskError("");
                        setTaskModalOpen(true);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>New Milestone</span>
                    </button>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Milestone Name</th>
                        <th className="pb-3 px-3 font-semibold">Project</th>
                        <th className="pb-3 px-3 font-semibold">Status (Click to toggle)</th>
                        <th className="pb-3 px-3 font-semibold">Start Date</th>
                        <th className="pb-3 px-3 font-semibold">Due Date</th>
                        <th className="pb-3 pl-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedTasks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No milestone records found for the selected filter.
                          </td>
                        </tr>
                      ) : (
                        displayedTasks.map((task) => {
                          let statusColor = "bg-amber-100 text-amber-700";
                          if (task.status === "COMPLETED") statusColor = "bg-emerald-100 text-emerald-700";
                          else if (task.status === "OVERDUE") statusColor = "bg-rose-100 text-rose-700";
                          else if (task.status === "PENDING") statusColor = "bg-purple-100 text-purple-700";

                          return (
                            <tr key={task.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3.5 pr-4">
                                <p className="font-semibold text-slate-800">{task.name}</p>
                                {task.description && (
                                  <p className="text-[10px] text-slate-400 truncate max-w-xs">{task.description}</p>
                                )}
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <span className="font-medium text-slate-700">{task.project.name}</span>
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <button
                                  onClick={() => handleCycleTaskStatus(task.id, task.status)}
                                  title="Click to cycle status"
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${statusColor} hover:opacity-80 transition cursor-pointer`}
                                >
                                  {task.status.replace("_", " ")}
                                </button>
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap text-slate-500">
                                {task.startDate ? new Date(task.startDate).toLocaleDateString() : "N/A"}
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap text-slate-500">
                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "N/A"}
                              </td>
                              <td className="py-3.5 pl-3 whitespace-nowrap text-right space-x-2">
                                <button
                                  onClick={() => openEditTaskModal(task)}
                                  className="text-xs text-blue-600 hover:underline font-medium"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MATERIAL REQUESTS & APPROVALS */}
          {activeTab === "approvals" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Material Requisitions &amp; Approvals</h2>
                    <p className="text-xs text-slate-500">Review field requests submitted by Site Engineers, approve with notes or reject with reasons</p>
                  </div>
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full">
                    {data.pendingRequests.length} Pending Approval
                  </span>
                </div>

                {data.pendingRequests.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center text-xl mb-2">
                      ✓
                    </div>
                    <p className="text-sm font-semibold text-slate-700">All requisitions cleared!</p>
                    <p className="text-xs text-slate-400 mt-1">There are no pending material approval requests at this moment.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
                    {data.pendingRequests.map((req) => (
                      <div key={req.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-bold text-blue-600">{req.project.name}</span>
                            <span className="text-[10px] text-slate-400 block">{req.project.code} &bull; Requested by {req.requester.name || "Site Engineer"} ({new Date(req.createdAt).toLocaleDateString()})</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                            PENDING PM REVIEW
                          </span>
                        </div>

                        <div className="space-y-2 border-y border-slate-200/60 py-3 text-xs">
                          <p className="font-semibold text-slate-700">Requested Materials &amp; Quantity:</p>
                          <ul className="space-y-1.5">
                            {req.items.map((item) => (
                              <li key={item.id} className="flex items-center justify-between text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                                <span className="font-medium">{item.material.name}</span>
                                <span className="font-extrabold text-slate-800">{item.quantityRequested} {item.material.unit}</span>
                              </li>
                            ))}
                          </ul>
                          {req.notes && (
                            <p className="text-[11px] text-slate-500 italic mt-2 bg-amber-50/60 p-2 rounded-lg border border-amber-100">
                              <strong>Site Note:</strong> {req.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => openApprovalDialog(req, "REJECTED")}
                            className="px-4 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
                          >
                            Reject Request
                          </button>
                          <button
                            onClick={() => openApprovalDialog(req, "APPROVED")}
                            className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow transition"
                          >
                            Approve Request
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: DAILY REPORTS */}
          {activeTab === "reports" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="pb-5 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">Site Engineer Daily Reports</h2>
                  <p className="text-xs text-slate-500">Review field progress logs, weather conditions, work summaries, and site issues reported by site engineers</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {data.recentReports.map((report) => (
                    <div key={report.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-blue-600">{report.project.name}</span>
                          <span className="text-[10px] text-slate-400 block">Logged by {report.engineer.name || "Site Engineer"} &bull; {report.engineer.email}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          {new Date(report.date).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="text-xs space-y-2 pt-2 border-t border-slate-200/60">
                        <div>
                          <p className="font-semibold text-slate-700">Work Execution Summary:</p>
                          <p className="text-slate-600 mt-0.5">{report.workSummary}</p>
                        </div>
                        {report.weatherCondition && (
                          <p className="text-[11px] text-slate-500">🌦️ <strong>Weather Condition:</strong> {report.weatherCondition}</p>
                        )}
                        {report.issues && (
                          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-[11px] mt-2 border border-rose-100">
                            <strong>⚠️ Issues / Impediments Flagged:</strong> {report.issues}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: BUDGET & COST COMPARISON */}
          {activeTab === "budget" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="pb-5 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">Project Financials, Budget &amp; Cost Comparison</h2>
                  <p className="text-xs text-slate-500">Compare planned vs actual costs, track procurement and labor expenditures</p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6">
                  <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100">
                    <span className="text-xs font-bold text-blue-600 uppercase block">Total Committed Budget</span>
                    <span className="text-2xl font-black text-slate-800 mt-1 block">{formatCurrency(data.metrics.totalBudget)}</span>
                  </div>
                  <div className="p-5 rounded-2xl bg-rose-50/50 border border-rose-100">
                    <span className="text-xs font-bold text-rose-600 uppercase block">Total Recorded Expenses</span>
                    <span className="text-2xl font-black text-slate-800 mt-1 block">{formatCurrency(data.metrics.totalExpenses)}</span>
                  </div>
                  <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <span className="text-xs font-bold text-emerald-600 uppercase block">Remaining Balance</span>
                    <span className="text-2xl font-black text-slate-800 mt-1 block">{formatCurrency(data.metrics.remainingBudget)}</span>
                  </div>
                </div>

                {/* Detailed Table */}
                <div className="mt-8 overflow-x-auto">
                  <h3 className="text-sm font-bold text-slate-800 mb-3">Project-by-Project Cost Analysis</h3>
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Project Name</th>
                        <th className="pb-3 px-3 font-semibold">Planned Budget</th>
                        <th className="pb-3 px-3 font-semibold">Actual Spent</th>
                        <th className="pb-3 px-3 font-semibold">Remaining</th>
                        <th className="pb-3 px-3 font-semibold">Budget Utilized</th>
                        <th className="pb-3 pl-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.projects.map((proj) => (
                        <tr key={proj.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 pr-4 font-semibold text-slate-800">{proj.name}</td>
                          <td className="py-3.5 px-3 font-bold text-slate-800">{formatCurrency(proj.budget)}</td>
                          <td className="py-3.5 px-3 font-bold text-rose-600">{formatCurrency(proj.spent)}</td>
                          <td className="py-3.5 px-3 font-bold text-emerald-600">{formatCurrency(proj.remaining)}</td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-medium w-8">{proj.spentPercentage}%</span>
                              <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, proj.spentPercentage)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 pl-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {proj.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: WORKFORCE & ATTENDANCE */}
          {activeTab === "workforce" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="pb-5 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">Project Workforce &amp; Site Attendance</h2>
                  <p className="text-xs text-slate-500">Personnel, trades, wages and attendance tracking on your managed project sites</p>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Worker Name</th>
                        <th className="pb-3 px-3 font-semibold">Trade</th>
                        <th className="pb-3 px-3 font-semibold">Assigned Project</th>
                        <th className="pb-3 px-3 font-semibold">Daily Wage</th>
                        <th className="pb-3 px-3 font-semibold">Phone</th>
                        <th className="pb-3 pl-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.workforce.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 pr-4 font-semibold text-slate-800">
                            {w.worker.fullName}
                          </td>
                          <td className="py-3.5 px-3">{w.worker.trade}</td>
                          <td className="py-3.5 px-3 font-medium text-slate-700">{w.project.name}</td>
                          <td className="py-3.5 px-3 font-bold text-slate-800">${w.worker.dailyWage}/day</td>
                          <td className="py-3.5 px-3 text-slate-500">{w.worker.phoneNumber || "N/A"}</td>
                          <td className="py-3.5 pl-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: MATERIALS INVENTORY */}
          {activeTab === "materials" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="pb-5 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">Materials Availability &amp; Inventory</h2>
                  <p className="text-xs text-slate-500">Monitor on-site and warehouse materials, stock levels, and unit pricing</p>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Material Name</th>
                        <th className="pb-3 px-3 font-semibold">Current Stock</th>
                        <th className="pb-3 px-3 font-semibold">Unit Price</th>
                        <th className="pb-3 px-3 font-semibold">Reorder Level</th>
                        <th className="pb-3 pl-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.materials.map((m) => {
                        const isLow = m.quantity <= m.reorderLevel;
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3.5 pr-4 font-semibold text-slate-800">{m.name}</td>
                            <td className="py-3.5 px-3 font-bold text-slate-800">{m.quantity} {m.unit}</td>
                            <td className="py-3.5 px-3">${m.unitPrice}/{m.unit}</td>
                            <td className="py-3.5 px-3 text-slate-500">{m.reorderLevel} {m.unit}</td>
                            <td className="py-3.5 pl-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isLow ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                              }`}>
                                {isLow ? "Low Stock" : "Sufficient"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: PROCUREMENT ORDERS */}
          {activeTab === "procurement" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="pb-5 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">Procurement &amp; Purchase Orders</h2>
                  <p className="text-xs text-slate-500">Monitor supplier purchase orders and delivered shipments for project materials</p>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Order ID</th>
                        <th className="pb-3 px-3 font-semibold">Supplier</th>
                        <th className="pb-3 px-3 font-semibold">Total Cost</th>
                        <th className="pb-3 px-3 font-semibold">Ordered Date</th>
                        <th className="pb-3 pl-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.purchaseOrders.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 pr-4 font-semibold text-slate-800">PO-{po.id.slice(-6).toUpperCase()}</td>
                          <td className="py-3.5 px-3 font-medium text-slate-700">{po.supplier?.name} ({po.supplier?.phone})</td>
                          <td className="py-3.5 px-3 font-bold text-slate-800">{formatCurrency(po.totalAmount)}</td>
                          <td className="py-3.5 px-3 text-slate-500">{new Date(po.orderedAt).toLocaleDateString()}</td>
                          <td className="py-3.5 pl-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              {po.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* -------------------- MODAL: CREATE TASK / MILESTONE -------------------- */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Create Project Milestone</h3>
              <button
                onClick={() => setTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {taskError && (
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold">
                {taskError}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Project</label>
                <select
                  value={taskForm.projectId}
                  onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                >
                  {data.assignedProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Milestone Name</label>
                <input
                  type="text"
                  placeholder="e.g. Foundation Pouring, Structural Framing"
                  value={taskForm.name}
                  onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Details and milestone scope..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={taskForm.startDate}
                    onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Due Date</label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow disabled:opacity-50"
                >
                  {taskSubmitting ? "Creating..." : "Save Milestone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: EDIT TASK -------------------- */}
      {editTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Edit Milestone</h3>
              <button
                onClick={() => setEditTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Milestone Name</label>
                <input
                  type="text"
                  value={editTaskForm.name}
                  onChange={(e) => setEditTaskForm({ ...editTaskForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={editTaskForm.status}
                  onChange={(e) => setEditTaskForm({ ...editTaskForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="OVERDUE">Overdue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={editTaskForm.dueDate}
                  onChange={(e) => setEditTaskForm({ ...editTaskForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTaskModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editTaskSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow disabled:opacity-50"
                >
                  {editTaskSubmitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: APPROVAL / REJECTION -------------------- */}
      {approvalModalOpen && selectedReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {approvalActionType === "APPROVED" ? "Approve Material Requisition" : "Reject Material Requisition"}
              </h3>
              <button
                onClick={() => setApprovalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <p><strong>Project:</strong> {selectedReq.project.name} ({selectedReq.project.code})</p>
              <p><strong>Requester:</strong> {selectedReq.requester.name || "Site Engineer"}</p>
              <p><strong>Items:</strong> {selectedReq.items.map((i) => `${i.material.name} (${i.quantityRequested} ${i.material.unit})`).join(", ")}</p>
            </div>

            <form onSubmit={handleSubmitApproval} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Manager Remarks / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder={approvalActionType === "APPROVED" ? "Optional approval comments..." : "Provide reason for rejection..."}
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required={approvalActionType === "REJECTED"}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovalModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approvalSubmitting}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-semibold shadow disabled:opacity-50 ${
                    approvalActionType === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {approvalSubmitting ? "Processing..." : approvalActionType === "APPROVED" ? "Confirm Approval" : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
