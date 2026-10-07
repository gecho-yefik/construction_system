"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

// Types
interface ProjectItem {
  id: string;
  name: string;
  code: string;
  location: string;
  status: string;
  progress: number;
  manager: string;
  tasksCount: number;
  completedTasksCount: number;
  workforceCount: number;
  reportsCount: number;
  tasks: TaskItem[];
  workforce: { worker: WorkerItem }[];
}

interface TaskItem {
  id: string;
  name: string;
  description?: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
  startDate?: string;
  dueDate: string;
  completedAt?: string | null;
  project?: { id: string; name: string; code: string };
}

interface DailyReportItem {
  id: string;
  date: string;
  workSummary: string;
  weatherCondition: string | null;
  issues: string | null;
  project: { id: string; name: string; code: string; location?: string };
}

interface WorkerItem {
  id: string;
  fullName: string;
  trade: string;
  dailyWage: number;
  phoneNumber?: string | null;
  isActive?: boolean;
}

interface MaterialItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice?: number;
}

interface MaterialRequestItem {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED";
  notes: string | null;
  createdAt: string;
  project: { id: string; name: string; code: string };
  approver?: { name: string } | null;
  items: Array<{
    id: string;
    quantityRequested: number;
    material: { name: string; unit: string; quantity: number };
  }>;
}

interface AttendanceItem {
  id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";
  hoursWorked: number;
  project: { id: string; name: string; code: string };
  worker: { id: string; fullName: string; trade: string };
}

interface MaterialIssuanceItem {
  id: string;
  issuedTo: string;
  issuedAt: string;
  project: { name: string };
  items: Array<{
    quantityIssued: number;
    material: { name: string; unit: string };
  }>;
}

interface SiteEngineerData {
  metrics: {
    totalActiveProjects: number;
    totalTasksCount: number;
    completedTasksCount: number;
    inProgressTasksCount: number;
    pendingTasksCount: number;
    taskCompletionRate: number;
    myReportsCount: number;
    totalWorkers: number;
    presentWorkersToday: number;
    pendingRequestsCount: number;
    approvedRequestsCount: number;
    totalMaterials: number;
  };
  projects: ProjectItem[];
  myReports: DailyReportItem[];
  tasks: TaskItem[];
  materials: MaterialItem[];
  workers: WorkerItem[];
  myRequests: MaterialRequestItem[];
  recentAttendances: AttendanceItem[];
  issuances: MaterialIssuanceItem[];
}

export default function SiteEngineerDashboardPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "tasks" | "reports" | "attendance" | "requests" | "materials" | "projects"
  >("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Data State
  const [data, setData] = useState<SiteEngineerData>({
    metrics: {
      totalActiveProjects: 0,
      totalTasksCount: 0,
      completedTasksCount: 0,
      inProgressTasksCount: 0,
      pendingTasksCount: 0,
      taskCompletionRate: 0,
      myReportsCount: 0,
      totalWorkers: 0,
      presentWorkersToday: 0,
      pendingRequestsCount: 0,
      approvedRequestsCount: 0,
      totalMaterials: 0,
    },
    projects: [],
    myReports: [],
    tasks: [],
    materials: [],
    workers: [],
    myRequests: [],
    recentAttendances: [],
    issuances: [],
  });

  // Daily Report Form State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportForm, setReportForm] = useState({
    projectId: "",
    date: new Date().toISOString().split("T")[0],
    workSummary: "",
    weatherCondition: "Sunny / Clear",
    issues: "",
  });
  const [submittingReport, setSubmittingReport] = useState(false);

  // Attendance Form State
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<{ [workerId: string]: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" }>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Material Request Form State
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestNotes, setRequestNotes] = useState("");
  const [requestItems, setRequestItems] = useState<{ materialId: string; quantityRequested: number }[]>([
    { materialId: "", quantityRequested: 10 },
  ]);
  const [submittingReq, setSubmittingReq] = useState(false);

  // Fetch all site data
  const fetchData = async () => {
    try {
      const res = await fetch("/api/site-engineer/overview");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.projects && json.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(json.projects[0].id);
          setReportForm((prev) => ({ ...prev, projectId: json.projects[0].id }));
        }
      }
    } catch (err) {
      console.error("Failed to load site engineer data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Active selected project
  const activeProject = data.projects.find((p) => p.id === selectedProjectId) || data.projects[0];

  // Initialize attendance when active project changes
  useEffect(() => {
    if (activeProject?.workforce) {
      const init: { [workerId: string]: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" } = {};
      activeProject.workforce.forEach((w) => {
        init[w.worker.id] = "PRESENT";
      });
      setAttendanceRecords(init);
    }
  }, [selectedProjectId, activeProject]);

  // Submit Daily Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProject = reportForm.projectId || activeProject?.id;
    if (!targetProject || !reportForm.workSummary) return;

    setSubmittingReport(true);
    try {
      const res = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...reportForm,
          projectId: targetProject,
        }),
      });

      if (res.ok) {
        setReportForm({
          projectId: activeProject?.id || "",
          date: new Date().toISOString().split("T")[0],
          workSummary: "",
          weatherCondition: "Sunny / Clear",
          issues: "",
        });
        setReportModalOpen(false);
        fetchData();
        alert("✅ Daily work activity report recorded successfully!");
      } else {
        const errJson = await res.json();
        alert(errJson.error || "Failed to submit daily report");
      }
    } catch (err: any) {
      alert(err?.message || "Error submitting daily report");
    } finally {
      setSubmittingReport(false);
    }
  };

  // Save Worker Attendance
  const handleSaveAttendance = async () => {
    if (!activeProject) return;

    setSavingAttendance(true);
    try {
      const records = Object.entries(attendanceRecords).map(([workerId, status]) => ({
        workerId,
        status,
        hoursWorked: status === "HALF_DAY" ? 4.0 : status === "PRESENT" ? 8.0 : 0,
      }));

      const res = await fetch("/api/attendances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProject.id,
          date: attendanceDate,
          records,
        }),
      });

      if (res.ok) {
        alert("✅ Worker attendance saved successfully!");
        fetchData();
      } else {
        const errJson = await res.json();
        alert(errJson.error || "Failed to save attendance");
      }
    } catch (err: any) {
      alert(err?.message || "Error saving attendance");
    } finally {
      setSavingAttendance(false);
    }
  };

  // Fast cycle task status (Task completion / progress record)
  const handleCycleTaskStatus = async (taskId: string, currentStatus: string) => {
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
        fetchData();
      }
    } catch (err) {
      console.error("Error updating task status:", err);
    }
  };

  // Submit Material Requisition
  const handleSubmitMaterialRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;

    const validItems = requestItems.filter((i) => i.materialId && i.quantityRequested > 0);
    if (validItems.length === 0) {
      alert("Please select at least one material and quantity.");
      return;
    }

    setSubmittingReq(true);
    try {
      const res = await fetch("/api/material-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProject.id,
          notes: requestNotes.trim() || undefined,
          items: validItems,
        }),
      });

      if (res.ok) {
        setRequestModalOpen(false);
        setRequestNotes("");
        setRequestItems([{ materialId: "", quantityRequested: 10 }]);
        fetchData();
        alert("✅ Material requisition submitted to Project Manager for approval!");
      } else {
        const errJson = await res.json();
        alert(errJson.error || "Failed to submit material request");
      }
    } catch (err: any) {
      alert(err?.message || "Error submitting request");
    } finally {
      setSubmittingReq(false);
    }
  };

  // Sidebar Menu Items
  const menuItems = [
    { id: "dashboard", name: "Site Overview", icon: "dashboard" },
    { id: "tasks", name: "Progress & Tasks", icon: "tasks", badge: data.metrics.pendingTasksCount },
    { id: "reports", name: "Daily Work Reports", icon: "reports", badge: data.metrics.myReportsCount },
    { id: "attendance", name: "Worker Attendance", icon: "workforce" },
    { id: "requests", name: "Material Requests", icon: "procurement", badge: data.metrics.pendingRequestsCount },
    { id: "materials", name: "Materials on Site", icon: "materials" },
    { id: "projects", name: "Assigned Sites", icon: "projects" },
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
      case "workforce":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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
                    SITE OPERATIONS
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

          {/* User Profile Card */}
          <div className="px-4 py-3 border-b border-slate-800/60">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "E"}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0B132B] rounded-full"></span>
              </div>
              {sidebarOpen && (
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold text-white truncate">
                    {session?.user?.name || "Site Engineer"}
                  </span>
                  <span className="text-[10px] text-orange-400 font-medium truncate">
                    Site Field Engineer
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
          {/* Top Project Selector & Quick Actions Banner */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-xl">
                👷
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-slate-800">
                    Site Field Engineering &amp; Operations
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                    Live Site
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record work activities, supervise site workers, log daily attendance &amp; manage material requests.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Project Selector */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                <span className="font-semibold text-slate-500">Active Site:</span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setReportForm((prev) => ({ ...prev, projectId: e.target.value }));
                  }}
                  className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Action 1: File Daily Report */}
              <button
                onClick={() => setReportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>+ File Daily Report</span>
              </button>

              {/* Quick Action 2: Request Materials */}
              <button
                onClick={() => setRequestModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span>Request Materials</span>
              </button>
            </div>
          </div>

          {/* TAB 1: SITE DASHBOARD & OVERVIEW */}
          {activeTab === "dashboard" && (
            <>
              {/* ROW 1: 6 TOP STAT METRIC CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5">
                {/* 1. Active Sites */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Assigned Sites
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.totalActiveProjects}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("projects")} className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-blue-600 font-medium hover:underline text-left">
                    <span>{activeProject ? activeProject.name : "View Sites"}</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                {/* 2. Total Site Tasks */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Site Milestones
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

                {/* 3. Daily Reports */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        My Daily Reports
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.myReportsCount}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("reports")} className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-emerald-600 font-medium hover:underline text-left">
                    <span>View all logs</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                {/* 4. Active Workers */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Site Workforce
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {activeProject?.workforce?.length || data.metrics.totalWorkers}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("attendance")} className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-rose-600 font-medium hover:underline text-left">
                    <span>Record attendance</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                {/* 5. Pending Requisitions */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Material Requisitions
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800">
                        {data.metrics.pendingRequestsCount}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("requests")} className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-amber-600 font-medium hover:underline text-left">
                    <span>{data.metrics.approvedRequestsCount} approved requests</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                {/* 6. Site Materials Stock */}
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
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
                  <button onClick={() => setActiveTab("materials")} className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-teal-600 font-medium hover:underline text-left">
                    <span>Stock status</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>

              {/* ROW 2: ACTIVE SITE TASKS & ATTENDANCE PREVIEW */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
                {/* Left: Active Site Milestones (Tasks) */}
                <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-xs border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">
                        Worksite Tasks &amp; Milestones ({activeProject?.name || "Active Site"})
                      </h2>
                      <p className="text-[11px] text-slate-400">Click any status badge to record task completion</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("tasks")}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      View All
                    </button>
                  </div>

                  <div className="overflow-x-auto mt-4">
                    {data.tasks.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-400">No active tasks assigned to this worksite.</p>
                    ) : (
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-semibold">
                          <tr>
                            <th className="pb-3 pr-4 font-semibold">Task Name</th>
                            <th className="pb-3 px-3 font-semibold">Project</th>
                            <th className="pb-3 px-3 font-semibold">Status (Click to toggle)</th>
                            <th className="pb-3 pl-3 font-semibold">Due Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.tasks.slice(0, 6).map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3.5 pr-4 font-semibold text-slate-800">{t.name}</td>
                              <td className="py-3.5 px-3 whitespace-nowrap text-slate-500">{t.project?.name || activeProject?.name}</td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <button
                                  onClick={() => handleCycleTaskStatus(t.id, t.status)}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer hover:opacity-80 transition ${
                                    t.status === "COMPLETED"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : t.status === "IN_PROGRESS"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-purple-100 text-purple-700"
                                  }`}
                                >
                                  {t.status.replace("_", " ")}
                                </button>
                              </td>
                              <td className="py-3.5 pl-3 whitespace-nowrap text-slate-500">
                                {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Right: Today's Site Attendance Roster */}
                <div className="lg:col-span-4 bg-white rounded-2xl p-6 shadow-xs border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-800">Supervise Workers</h2>
                    <button onClick={() => setActiveTab("attendance")} className="text-xs font-semibold text-blue-600 hover:underline">
                      Log Full Roster
                    </button>
                  </div>

                  <div className="space-y-3 my-auto py-2">
                    <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">Assigned Personnel</span>
                        <span className="text-[10px] text-slate-500">{activeProject?.workforce?.length || 0} Tradesmen on Site</span>
                      </div>
                      <span className="text-lg font-black text-blue-600">{activeProject?.workforce?.length || 0}</span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {(!activeProject?.workforce || activeProject.workforce.length === 0) ? (
                        <p className="text-xs text-slate-400 text-center py-4">No workers assigned to this project yet.</p>
                      ) : (
                        activeProject.workforce.map((w) => (
                          <div key={w.worker.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-slate-800">{w.worker.fullName}</p>
                              <span className="text-[10px] text-slate-400">{w.worker.trade} &bull; ${w.worker.dailyWage}/day</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              Active
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ROW 3: RECENT DAILY REPORTS & MATERIAL REQUESTS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
                {/* 1. Recent Daily Reports Filed */}
                <div className="lg:col-span-6 bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-800">Recent Daily Work Logs</h3>
                    <button onClick={() => setActiveTab("reports")} className="text-xs font-semibold text-blue-600 hover:underline">
                      View All
                    </button>
                  </div>

                  <div className="space-y-3 mt-4">
                    {data.myReports.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No daily work reports submitted yet.</p>
                    ) : (
                      data.myReports.slice(0, 3).map((r) => (
                        <div key={r.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-blue-600">{r.project.name}</span>
                            <span className="text-slate-400 text-[11px]">{new Date(r.date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-700">{r.workSummary}</p>
                          {r.issues && (
                            <p className="text-[10px] text-rose-600 font-medium">⚠️ {r.issues}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Material Requisitions Status */}
                <div className="lg:col-span-6 bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-800">Material Requisition Track</h3>
                    <button onClick={() => setActiveTab("requests")} className="text-xs font-semibold text-blue-600 hover:underline">
                      View All
                    </button>
                  </div>

                  <div className="space-y-3 mt-4">
                    {data.myRequests.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No material requisitions recorded yet.</p>
                    ) : (
                      data.myRequests.slice(0, 3).map((req) => (
                        <div key={req.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {req.items.map((i) => `${i.material.name} (${i.quantityRequested} ${i.material.unit})`).join(", ")}
                            </span>
                            <span className="text-[10px] text-slate-400">{req.project.name} &bull; {new Date(req.createdAt).toLocaleDateString()}</span>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-700"
                              : req.status === "REJECTED"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {req.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: PROGRESS & TASKS */}
          {activeTab === "tasks" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Site Tasks &amp; Project Progress Tracking</h2>
                    <p className="text-xs text-slate-500">Record milestone progress and update task completion in real-time</p>
                  </div>
                  <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-100">
                    Completion Rate: {data.metrics.taskCompletionRate}%
                  </span>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Milestone / Task</th>
                        <th className="pb-3 px-3 font-semibold">Project</th>
                        <th className="pb-3 px-3 font-semibold">Status (Click to toggle)</th>
                        <th className="pb-3 px-3 font-semibold">Due Date</th>
                        <th className="pb-3 pl-3 font-semibold">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.tasks.map((task) => (
                        <tr key={task.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 pr-4">
                            <p className="font-semibold text-slate-800">{task.name}</p>
                            {task.description && <p className="text-[10px] text-slate-400">{task.description}</p>}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap text-slate-700 font-medium">{task.project?.name || activeProject?.name}</td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <button
                              onClick={() => handleCycleTaskStatus(task.id, task.status)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                                task.status === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : task.status === "IN_PROGRESS"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {task.status.replace("_", " ")}
                            </button>
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap text-slate-500">
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="py-3.5 pl-3 whitespace-nowrap">
                            {task.status !== "COMPLETED" ? (
                              <button
                                onClick={() => handleCycleTaskStatus(task.id, "IN_PROGRESS")}
                                className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition"
                              >
                                Mark Done ✓
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-bold text-xs">Completed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DAILY WORK REPORTS */}
          {activeTab === "reports" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Daily Site Work Activities &amp; Logs</h2>
                    <p className="text-xs text-slate-500">Record daily construction logs, weather conditions and impediments</p>
                  </div>
                  <button
                    onClick={() => setReportModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>+ File New Daily Report</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {data.myReports.map((report) => (
                    <div key={report.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-blue-600">{report.project.name}</span>
                          <span className="text-[10px] text-slate-400 block">{report.project.code} &bull; 📍 {report.project.location || "On site"}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          {new Date(report.date).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="text-xs space-y-2 pt-2 border-t border-slate-200/60">
                        <div>
                          <p className="font-semibold text-slate-700">Executed Work Activities:</p>
                          <p className="text-slate-600 mt-0.5">{report.workSummary}</p>
                        </div>
                        {report.weatherCondition && (
                          <p className="text-[11px] text-slate-500">🌦️ <strong>Weather:</strong> {report.weatherCondition}</p>
                        )}
                        {report.issues && (
                          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-[11px] border border-rose-100">
                            <strong>⚠️ Issues / Bottlenecks:</strong> {report.issues}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WORKER MANAGEMENT & ATTENDANCE */}
          {activeTab === "attendance" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Worker Supervision &amp; Attendance Log</h2>
                    <p className="text-xs text-slate-500">Supervise assigned tradesmen, track hours worked and mark daily site attendance</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                    <button
                      onClick={handleSaveAttendance}
                      disabled={savingAttendance}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow transition disabled:opacity-50"
                    >
                      {savingAttendance ? "Saving..." : "Save Attendance"}
                    </button>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Worker Name</th>
                        <th className="pb-3 px-3 font-semibold">Trade</th>
                        <th className="pb-3 px-3 font-semibold">Daily Wage</th>
                        <th className="pb-3 pl-3 font-semibold">Attendance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(!activeProject?.workforce || activeProject.workforce.length === 0) ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            No workforce registered under this site yet.
                          </td>
                        </tr>
                      ) : (
                        activeProject.workforce.map((w) => {
                          const currentStatus = attendanceRecords[w.worker.id] || "PRESENT";
                          return (
                            <tr key={w.worker.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3.5 pr-4 font-bold text-slate-800">{w.worker.fullName}</td>
                              <td className="py-3.5 px-3">{w.worker.trade}</td>
                              <td className="py-3.5 px-3 font-semibold text-slate-700">${w.worker.dailyWage}/day</td>
                              <td className="py-3.5 pl-3">
                                <div className="flex items-center gap-1.5">
                                  {(["PRESENT", "HALF_DAY", "ABSENT", "LEAVE"] as const).map((st) => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => setAttendanceRecords({ ...attendanceRecords, [w.worker.id]: st })}
                                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                                        currentStatus === st
                                          ? st === "PRESENT"
                                            ? "bg-emerald-600 text-white shadow-xs"
                                            : st === "HALF_DAY"
                                            ? "bg-amber-500 text-white shadow-xs"
                                            : st === "ABSENT"
                                            ? "bg-rose-600 text-white shadow-xs"
                                            : "bg-purple-600 text-white shadow-xs"
                                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                      }`}
                                    >
                                      {st.replace("_", " ")}
                                    </button>
                                  ))}
                                </div>
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

          {/* TAB 5: MATERIAL REQUESTS */}
          {activeTab === "requests" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Material Requests &amp; Requisitions</h2>
                    <p className="text-xs text-slate-500">Identify and submit required materials to the Project Manager for site delivery</p>
                  </div>
                  <button
                    onClick={() => setRequestModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>+ Submit New Requisition</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {data.myRequests.map((req) => (
                    <div key={req.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-blue-600">{req.project.name}</span>
                          <span className="text-[10px] text-slate-400 block">{new Date(req.createdAt).toLocaleDateString()}</span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-700"
                            : req.status === "REJECTED"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      <div className="text-xs space-y-2 pt-2 border-t border-slate-200/60">
                        <p className="font-semibold text-slate-700">Requested Items:</p>
                        <ul className="space-y-1">
                          {req.items.map((i) => (
                            <li key={i.id} className="flex justify-between text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                              <span>{i.material.name}</span>
                              <span className="font-bold text-slate-800">{i.quantityRequested} {i.material.unit}</span>
                            </li>
                          ))}
                        </ul>
                        {req.notes && (
                          <p className="text-[11px] text-slate-500 italic mt-2">Notes: {req.notes}</p>
                        )}
                        {req.approver && (
                          <p className="text-[10px] text-emerald-600 font-semibold">Reviewed by: {req.approver.name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: MATERIALS INVENTORY */}
          {activeTab === "materials" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="pb-5 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">Construction Materials Catalog &amp; Stock Availability</h2>
                  <p className="text-xs text-slate-500">Monitor current stock and identify materials for site requisition</p>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Material Name</th>
                        <th className="pb-3 px-3 font-semibold">Warehouse / Site Stock</th>
                        <th className="pb-3 px-3 font-semibold">Unit Price</th>
                        <th className="pb-3 pl-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.materials.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 pr-4 font-bold text-slate-800">{m.name}</td>
                          <td className="py-3.5 px-3 font-extrabold text-slate-800">{m.quantity} {m.unit}</td>
                          <td className="py-3.5 px-3 text-slate-600">${m.unitPrice || 0}/{m.unit}</td>
                          <td className="py-3.5 pl-3">
                            <button
                              onClick={() => {
                                setRequestItems([{ materialId: m.id, quantityRequested: 10 }]);
                                setRequestModalOpen(true);
                              }}
                              className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-semibold transition"
                            >
                              Request This Item +
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: ASSIGNED SITES */}
          {activeTab === "projects" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-100">
                <div className="pb-5 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">Assigned Project Worksites</h2>
                  <p className="text-xs text-slate-500">Project details, location scopes and personnel assigned under your engineering supervision</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                  {data.projects.map((proj) => (
                    <div key={proj.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:shadow-md transition-all space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm">{proj.name}</h3>
                          <span className="text-[11px] text-slate-400 block">{proj.code} &bull; 📍 {proj.location}</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          {proj.status}
                        </span>
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

                      <div className="p-3 bg-white rounded-xl border border-slate-100 text-xs space-y-1 text-slate-600">
                        <p><strong>Project Manager:</strong> {proj.manager}</p>
                        <p><strong>Total Milestones:</strong> {proj.tasksCount}</p>
                        <p><strong>Assigned Tradesmen:</strong> {proj.workforceCount}</p>
                        <p><strong>Daily Reports Logged:</strong> {proj.reportsCount}</p>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedProjectId(proj.id);
                          setActiveTab("dashboard");
                        }}
                        className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-semibold transition"
                      >
                        Set as Active Site ➔
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* -------------------- MODAL: FILE DAILY REPORT -------------------- */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Record Daily Work Activities</h3>
              <button onClick={() => setReportModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Project Worksite</label>
                <select
                  value={reportForm.projectId || activeProject?.id}
                  onChange={(e) => setReportForm({ ...reportForm, projectId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                >
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={reportForm.date}
                    onChange={(e) => setReportForm({ ...reportForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Weather Condition</label>
                  <select
                    value={reportForm.weatherCondition}
                    onChange={(e) => setReportForm({ ...reportForm, weatherCondition: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option>Sunny / Clear</option>
                    <option>Overcast / Cloudy</option>
                    <option>Rain / Wet Site</option>
                    <option>High Wind</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Daily Work Activities &amp; Progress Summary</label>
                <textarea
                  rows={4}
                  placeholder="Detail masonry, concrete pours, framing, installations, or inspections executed today..."
                  value={reportForm.workSummary}
                  onChange={(e) => setReportForm({ ...reportForm, workSummary: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Site Issues / Impediments / Safety Hazards (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Note any material shortages, broken tools, weather delays, or safety concerns..."
                  value={reportForm.issues}
                  onChange={(e) => setReportForm({ ...reportForm, issues: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow disabled:opacity-50"
                >
                  {submittingReport ? "Submitting..." : "Save Daily Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: SUBMIT MATERIAL REQUEST -------------------- */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Submit Material Requisition</h3>
              <button onClick={() => setRequestModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
            </div>

            <form onSubmit={handleSubmitMaterialRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destination Worksite</label>
                <p className="text-xs font-semibold text-blue-600 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                  📍 {activeProject?.name} ({activeProject?.code})
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Requested Items</label>
                  <button
                    type="button"
                    onClick={() => setRequestItems([...requestItems, { materialId: "", quantityRequested: 10 }])}
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >
                    + Add Another Item
                  </button>
                </div>

                {requestItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={item.materialId}
                      onChange={(e) => {
                        const updated = [...requestItems];
                        updated[idx].materialId = e.target.value;
                        setRequestItems(updated);
                      }}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      required
                    >
                      <option value="">Select Material...</option>
                      {data.materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Stock: {m.quantity} {m.unit})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min={1}
                      value={item.quantityRequested}
                      onChange={(e) => {
                        const updated = [...requestItems];
                        updated[idx].quantityRequested = Number(e.target.value);
                        setRequestItems(updated);
                      }}
                      placeholder="Qty"
                      className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      required
                    />

                    {requestItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRequestItems(requestItems.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 p-2 text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Requisition Remarks / Urgency Notes</label>
                <textarea
                  rows={2}
                  placeholder="Specify delivery timeline, zone/floor placement, or priority..."
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReq}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow disabled:opacity-50"
                >
                  {submittingReq ? "Submitting..." : "Send Request to PM"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
