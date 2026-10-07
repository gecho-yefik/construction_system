"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Worker {
  id: string;
  fullName: string;
  nationalId: string | null;
  phoneNumber: string | null;
  trade: string;
  dailyWage: number;
  isActive: boolean;
  assignments: {
    project: { id: string; name: string; code: string; status?: string };
  }[];
  _count: {
    attendances: number;
  };
}

interface Project {
  id: string;
  name: string;
  code: string;
  _count?: { workforce: number };
}

interface TradeCount {
  trade: string;
  count: number;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "OVERTIME" | "LATE";
  hoursWorked: number;
  worker: {
    id: string;
    fullName: string;
    trade: string;
    dailyWage: number;
    phoneNumber?: string | null;
  };
  project: {
    id: string;
    name: string;
    code: string;
  };
}

const COMMON_TRADES = [
  "Mason",
  "Carpenter",
  "Electrician",
  "Plumber",
  "Steel Fixer",
  "Welder",
  "Painter",
  "General Laborer",
  "Surveyor",
  "Crane Operator",
  "Heavy Equipment Operator",
  "Foreman",
  "Scaffolder",
  "Plasterer",
];

export default function HRManagerPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<
    "directory" | "attendance" | "logs" | "payroll" | "deployments"
  >("directory");

  const [metrics, setMetrics] = useState<{
    totalWorkers: number;
    activeWorkers: number;
    presentToday: number;
    absentToday: number;
    activeProjectsCount: number;
    todayLaborCost: number;
  }>({
    totalWorkers: 0,
    activeWorkers: 0,
    presentToday: 0,
    absentToday: 0,
    activeProjectsCount: 0,
    todayLaborCost: 0,
  });

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [trades, setTrades] = useState<TradeCount[]>([]);

  // Directory Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("ALL");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Modal: Register Worker
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    nationalId: "",
    phoneNumber: "",
    trade: "Mason",
    dailyWage: "450",
    projectId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Modal: Edit Worker
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    nationalId: "",
    phoneNumber: "",
    trade: "Mason",
    dailyWage: "450",
    isActive: true,
  });

  // Modal: Assign Worker
  const [assignModalWorker, setAssignModalWorker] = useState<Worker | null>(null);
  const [assignProjectId, setAssignProjectId] = useState("");

  // Attendance Sheet (Daily Roll Call) State
  const [rollCallProject, setRollCallProject] = useState<string>("");
  const [rollCallDate, setRollCallDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [rollCallEntries, setRollCallEntries] = useState<
    Record<string, { status: "PRESENT" | "ABSENT" | "HALF_DAY" | "OVERTIME"; hours: number }>
  >({});
  const [savingRollCall, setSavingRollCall] = useState(false);
  const [rollCallSuccess, setRollCallSuccess] = useState(false);

  // Attendance Logs State
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilterProject, setLogFilterProject] = useState("ALL");
  const [logFilterDate, setLogFilterDate] = useState("");

  // Fetch Overview Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/hr-manager/overview");
      if (!res.ok) {
        throw new Error("Failed to load HR overview data");
      }
      const data = await res.json();
      setMetrics(data.metrics || {});
      setWorkers(data.workers || []);
      setProjects(data.projects || []);
      setTrades(data.trades || []);

      if (data.projects && data.projects.length > 0 && !rollCallProject) {
        setRollCallProject(data.projects[0].id);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  // Fetch Attendance Logs when Tab is Active
  const fetchAttendanceLogs = async () => {
    try {
      setLoadingLogs(true);
      let url = "/api/attendances?";
      if (logFilterProject !== "ALL") url += `projectId=${logFilterProject}&`;
      if (logFilterDate) url += `date=${logFilterDate}&`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAttendanceLogs(data || []);
      }
    } catch (e) {
      console.error("Error fetching logs:", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "logs") {
      fetchAttendanceLogs();
    }
  }, [activeTab, logFilterProject, logFilterDate]);

  // Initialize Roll Call Table when Project or Date changes
  useEffect(() => {
    if (!rollCallProject) return;
    const projectWorkers = workers.filter(
      (w) => w.isActive && w.assignments.some((a) => a.project.id === rollCallProject)
    );
    const initial: Record<
      string,
      { status: "PRESENT" | "ABSENT" | "HALF_DAY" | "OVERTIME"; hours: number }
    > = {};
    projectWorkers.forEach((w) => {
      initial[w.id] = { status: "PRESENT", hours: 8 };
    });
    setRollCallEntries(initial);
    setRollCallSuccess(false);
  }, [rollCallProject, workers]);

  // Handle Worker Registration
  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create worker");

      setShowAddModal(false);
      setFormData({
        fullName: "",
        nationalId: "",
        phoneNumber: "",
        trade: "Mason",
        dailyWage: "450",
        projectId: "",
      });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Worker Edit
  const handleEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/workers/${editingWorker.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update worker");

      setEditingWorker(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Project Assignment
  const handleAssignWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalWorker || !assignProjectId) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/workers/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: assignModalWorker.id,
          projectId: assignProjectId,
          action: "assign",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign worker");

      setAssignModalWorker(null);
      setAssignProjectId("");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Unassign Worker
  const handleUnassignWorker = async (workerId: string, projectId: string) => {
    if (!confirm("Are you sure you want to remove this worker from this site?")) return;
    try {
      const res = await fetch("/api/workers/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId,
          projectId,
          action: "unassign",
        }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Active Status
  const handleToggleWorkerStatus = async (worker: Worker) => {
    try {
      const res = await fetch(`/api/workers/${worker.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !worker.isActive }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Roll Call Submission
  const handleSubmitRollCall = async () => {
    if (!rollCallProject || !rollCallDate) {
      alert("Please select a project and date");
      return;
    }

    const records = Object.entries(rollCallEntries).map(([workerId, entry]) => ({
      workerId,
      status: entry.status,
      hoursWorked: entry.hours,
    }));

    if (records.length === 0) {
      alert("No workers assigned to this project to record attendance for.");
      return;
    }

    try {
      setSavingRollCall(true);
      const res = await fetch("/api/attendances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: rollCallProject,
          date: rollCallDate,
          records,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record attendance");

      setRollCallSuccess(true);
      fetchData();
      setTimeout(() => setRollCallSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingRollCall(false);
    }
  };

  // Mark all roll call entries present
  const setAllRollCallStatus = (status: "PRESENT" | "ABSENT") => {
    const updated = { ...rollCallEntries };
    Object.keys(updated).forEach((id) => {
      updated[id] = {
        status,
        hours: status === "PRESENT" ? 8 : 0,
      };
    });
    setRollCallEntries(updated);
  };

  // Filtered Workers for Directory
  const filteredWorkers = workers.filter((w) => {
    const matchesSearch =
      w.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.nationalId && w.nationalId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (w.phoneNumber && w.phoneNumber.includes(searchTerm));

    const matchesTrade = selectedTrade === "ALL" || w.trade === selectedTrade;

    const matchesProject =
      selectedProjectFilter === "ALL" ||
      w.assignments.some((a) => a.project.id === selectedProjectFilter);

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && w.isActive) ||
      (statusFilter === "INACTIVE" && !w.isActive);

    return matchesSearch && matchesTrade && matchesProject && matchesStatus;
  });

  // Roll call candidate workers
  const rollCallCandidates = workers.filter(
    (w) => w.isActive && w.assignments.some((a) => a.project.id === rollCallProject)
  );

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20 text-xl">
              👥
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-400 bg-clip-text text-transparent">
                HR & Workforce Management
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Staff directory, daily attendance roll call, trade distribution, and Ethiopian Birr (ETB) payroll analytics.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 transition duration-200"
          >
            <span>➕ Register Worker</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl">
          <div className="text-xs font-semibold uppercase text-slate-400">Total Workforce</div>
          <div className="text-2xl font-black mt-1 text-white">{metrics.totalWorkers}</div>
          <div className="text-xs text-slate-500 mt-1">Registered personnel</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/20 backdrop-blur-sm shadow-xl">
          <div className="text-xs font-semibold uppercase text-emerald-400">Active Workers</div>
          <div className="text-2xl font-black mt-1 text-emerald-400">{metrics.activeWorkers}</div>
          <div className="text-xs text-slate-500 mt-1">Ready for site duty</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-blue-500/20 backdrop-blur-sm shadow-xl">
          <div className="text-xs font-semibold uppercase text-blue-400">Present Today</div>
          <div className="text-2xl font-black mt-1 text-blue-400">{metrics.presentToday}</div>
          <div className="text-xs text-slate-500 mt-1">On duty across sites</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/20 backdrop-blur-sm shadow-xl">
          <div className="text-xs font-semibold uppercase text-rose-400">Absent Today</div>
          <div className="text-2xl font-black mt-1 text-rose-400">{metrics.absentToday}</div>
          <div className="text-xs text-slate-500 mt-1">Reported absent</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/20 backdrop-blur-sm shadow-xl">
          <div className="text-xs font-semibold uppercase text-purple-400">Staffed Sites</div>
          <div className="text-2xl font-black mt-1 text-purple-400">{metrics.activeProjectsCount}</div>
          <div className="text-xs text-slate-500 mt-1">Active projects</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 backdrop-blur-sm shadow-xl">
          <div className="text-xs font-semibold uppercase text-amber-400">Today's Payroll</div>
          <div className="text-2xl font-black mt-1 text-amber-400">
            {(metrics.todayLaborCost || 0).toLocaleString()} <span className="text-xs font-normal">ETB</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Est. daily labor total (ብር)</div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-px">
        {[
          { id: "directory", label: "👥 Workforce Directory", count: workers.length },
          { id: "attendance", label: "📋 Daily Roll Call / Mark Attendance" },
          { id: "logs", label: "📅 Attendance History & Logs" },
          { id: "payroll", label: "💵 Payroll & Labor Costs (ETB)" },
          { id: "deployments", label: "🏗️ Site Allocations" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 rounded-t-xl font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${
              activeTab === tab.id
                ? "bg-slate-800/80 text-amber-400 border-amber-500 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-transparent"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-300 font-semibold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: WORKFORCE DIRECTORY */}
      {activeTab === "directory" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Trade Filter Card */}
          <div className="lg:col-span-1 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-sm h-fit">
            <h2 className="text-base font-bold text-slate-200 mb-3 flex items-center justify-between">
              <span>🛠️ Trades Breakdown</span>
              <span className="text-xs text-slate-500">{trades.length} trades</span>
            </h2>
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              <button
                onClick={() => setSelectedTrade("ALL")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition ${
                  selectedTrade === "ALL"
                    ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30"
                    : "text-slate-400 hover:bg-slate-800/60"
                }`}
              >
                <span>All Trades</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-300">
                  {workers.length}
                </span>
              </button>
              {trades.map((t) => (
                <button
                  key={t.trade}
                  onClick={() => setSelectedTrade(t.trade)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition ${
                    selectedTrade === t.trade
                      ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30"
                      : "text-slate-400 hover:bg-slate-800/60"
                  }`}
                >
                  <span>{t.trade}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-300">
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Directory Table */}
          <div className="lg:col-span-3 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-sm flex flex-col">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <span>📋 Personnel Directory</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                  {filteredWorkers.length} workers
                </span>
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search name, ID, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <select
                  value={selectedProjectFilter}
                  onChange={(e) => setSelectedProjectFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ALL">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-slate-500 text-sm">Loading workforce records...</div>
            ) : filteredWorkers.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                No workers found matching your search.
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                      <th className="py-3 px-3">Worker Info</th>
                      <th className="py-3 px-3">Trade / Skill</th>
                      <th className="py-3 px-3">Daily Wage (ETB)</th>
                      <th className="py-3 px-3">Assigned Sites</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredWorkers.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-200">{w.fullName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span>ID: {w.nationalId || "N/A"}</span>
                            {w.phoneNumber && <span>• 📞 {w.phoneNumber}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-amber-300">
                            {w.trade}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-300">
                          {w.dailyWage.toLocaleString()} <span className="text-xs text-slate-500">ETB / day</span>
                        </td>
                        <td className="py-3 px-3">
                          {w.assignments.length === 0 ? (
                            <span className="text-xs text-slate-500 italic">Unassigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {w.assignments.map((a) => (
                                <span
                                  key={a.project.id}
                                  className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs"
                                >
                                  {a.project.code}
                                  <button
                                    onClick={() => handleUnassignWorker(w.id, a.project.id)}
                                    title="Unassign"
                                    className="text-blue-400 hover:text-rose-400 ml-0.5"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleToggleWorkerStatus(w)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                              w.isActive
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
                            }`}
                          >
                            {w.isActive ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingWorker(w);
                                setEditFormData({
                                  fullName: w.fullName,
                                  nationalId: w.nationalId || "",
                                  phoneNumber: w.phoneNumber || "",
                                  trade: w.trade,
                                  dailyWage: w.dailyWage.toString(),
                                  isActive: w.isActive,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
                              title="Edit Worker"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => {
                                setAssignModalWorker(w);
                                setAssignProjectId(projects[0]?.id || "");
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-medium text-amber-300 transition"
                            >
                              + Assign Site
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DAILY ROLL CALL / ATTENDANCE */}
      {activeTab === "attendance" && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📋 Daily Site Attendance Roll Call</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Mark attendance, working hours, and presence for workers assigned to a specific project site.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Select Project</label>
                <select
                  value={rollCallProject}
                  onChange={(e) => setRollCallProject(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  value={rollCallDate}
                  onChange={(e) => setRollCallDate(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="self-end flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAllRollCallStatus("PRESENT")}
                  className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-medium text-emerald-400 transition"
                >
                  ✓ All Present
                </button>
                <button
                  type="button"
                  onClick={() => setAllRollCallStatus("ABSENT")}
                  className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-medium text-rose-400 transition"
                >
                  ✗ All Absent
                </button>
              </div>
            </div>
          </div>

          {rollCallSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
              <span>✅</span> Attendance records successfully logged and synced with project costs!
            </div>
          )}

          {rollCallCandidates.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              No active workers currently assigned to this project. Go to the{" "}
              <button
                onClick={() => setActiveTab("directory")}
                className="text-amber-400 hover:underline font-semibold"
              >
                Workforce Directory
              </button>{" "}
              to assign personnel to this site.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                    <th className="py-3 px-3">Worker Name</th>
                    <th className="py-3 px-3">Trade</th>
                    <th className="py-3 px-3">Daily Wage (ETB)</th>
                    <th className="py-3 px-3">Attendance Status</th>
                    <th className="py-3 px-3">Hours Worked</th>
                    <th className="py-3 px-3 text-right">Computed Pay (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rollCallCandidates.map((w) => {
                    const entry = rollCallEntries[w.id] || { status: "PRESENT", hours: 8 };
                    const computedCost =
                      entry.status === "PRESENT"
                        ? Math.round(w.dailyWage * (entry.hours / 8))
                        : entry.status === "HALF_DAY"
                        ? Math.round(w.dailyWage * 0.5)
                        : entry.status === "OVERTIME"
                        ? Math.round(w.dailyWage * (entry.hours / 8))
                        : 0;

                    return (
                      <tr key={w.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-200">{w.fullName}</div>
                          <div className="text-xs text-slate-500">{w.phoneNumber || "No phone"}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-xs text-amber-300 font-medium">
                            {w.trade}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-medium">
                          {w.dailyWage.toLocaleString()} ETB
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: "Present", val: "PRESENT", color: "emerald" },
                              { label: "Half-Day", val: "HALF_DAY", color: "amber" },
                              { label: "Overtime", val: "OVERTIME", color: "blue" },
                              { label: "Absent", val: "ABSENT", color: "rose" },
                            ].map((st) => (
                              <button
                                key={st.val}
                                type="button"
                                onClick={() => {
                                  setRollCallEntries({
                                    ...rollCallEntries,
                                    [w.id]: {
                                      status: st.val as any,
                                      hours:
                                        st.val === "PRESENT"
                                          ? 8
                                          : st.val === "HALF_DAY"
                                          ? 4
                                          : st.val === "OVERTIME"
                                          ? 10
                                          : 0,
                                    },
                                  });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                  entry.status === st.val
                                    ? `bg-${st.color}-500/20 text-${st.color}-400 border border-${st.color}-500/40`
                                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                }`}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.5"
                            value={entry.hours}
                            disabled={entry.status === "ABSENT"}
                            onChange={(e) => {
                              const hrs = parseFloat(e.target.value) || 0;
                              setRollCallEntries({
                                ...rollCallEntries,
                                [w.id]: { ...entry, hours: hrs },
                              });
                            }}
                            className="w-20 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-40"
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-amber-400">
                          {computedCost.toLocaleString()} ETB
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-sm text-slate-400">
                  Total Roll Call Payroll:{" "}
                  <span className="text-amber-400 font-bold text-lg">
                    {rollCallCandidates
                      .reduce((sum, w) => {
                        const entry = rollCallEntries[w.id] || { status: "PRESENT", hours: 8 };
                        if (entry.status === "PRESENT" || entry.status === "OVERTIME") {
                          return sum + Math.round(w.dailyWage * (entry.hours / 8));
                        }
                        if (entry.status === "HALF_DAY") return sum + Math.round(w.dailyWage * 0.5);
                        return sum;
                      }, 0)
                      .toLocaleString()}{" "}
                    ETB
                  </span>
                </div>

                <button
                  type="button"
                  disabled={savingRollCall}
                  onClick={handleSubmitRollCall}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition duration-200 disabled:opacity-50"
                >
                  {savingRollCall ? "Saving Attendance..." : "💾 Save & Sync Roll Call"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ATTENDANCE LOGS */}
      {activeTab === "logs" && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white">📅 Historic Attendance Records</h2>
              <p className="text-xs text-slate-400 mt-1">Audit past attendance logs per project and worker in Ethiopian Birr.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={logFilterProject}
                onChange={(e) => setLogFilterProject(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="ALL">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={logFilterDate}
                onChange={(e) => setLogFilterDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />

              {logFilterDate && (
                <button
                  onClick={() => setLogFilterDate("")}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-400 hover:text-white"
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>

          {loadingLogs ? (
            <div className="py-16 text-center text-slate-500 text-sm">Loading attendance logs...</div>
          ) : attendanceLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              No attendance records found for the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Worker</th>
                    <th className="py-3 px-3">Trade</th>
                    <th className="py-3 px-3">Project</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Hours</th>
                    <th className="py-3 px-3 text-right">Labor Cost (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {attendanceLogs.map((log) => {
                    const cost =
                      log.status === "PRESENT"
                        ? Math.round((log.worker?.dailyWage || 0) * ((log.hoursWorked || 8) / 8))
                        : 0;

                    return (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 text-slate-300 font-mono text-xs">
                          {new Date(log.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-200">
                          {log.worker?.fullName || "Unknown Worker"}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-400">
                          {log.worker?.trade || "General"}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">
                            {log.project?.code || log.project?.name}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              log.status === "PRESENT"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">{log.hoursWorked} hrs</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-400">
                          {cost.toLocaleString()} ETB
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PAYROLL & LABOR COSTS */}
      {activeTab === "payroll" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase text-slate-400">Monthly Est. Payroll</div>
              <div className="text-2xl font-black mt-2 text-white">
                {workers
                  .filter((w) => w.isActive)
                  .reduce((sum, w) => sum + w.dailyWage * 24, 0)
                  .toLocaleString()}{" "}
                <span className="text-sm font-normal text-amber-400">ETB</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">Based on 24 working days/month (የወር ግምት)</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase text-slate-400">Average Daily Wage</div>
              <div className="text-2xl font-black mt-2 text-amber-400">
                {workers.length > 0
                  ? Math.round(
                      workers.reduce((sum, w) => sum + w.dailyWage, 0) / workers.length
                    ).toLocaleString()
                  : 0}{" "}
                <span className="text-sm font-normal text-slate-400">ETB</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">Across all registered trades (አማካይ የቀን ደመወዝ)</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase text-slate-400">Highest Paid Trade</div>
              <div className="text-2xl font-black mt-2 text-emerald-400">
                {workers.length > 0
                  ? workers.reduce((max, w) => (w.dailyWage > max.dailyWage ? w : max), workers[0])
                      .trade
                  : "N/A"}
              </div>
              <div className="text-xs text-slate-500 mt-1">Specialist skilled labor</div>
            </div>
          </div>

          {/* Trade Labor Cost Breakdown */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
            <h2 className="text-base font-bold text-slate-200 mb-4">
              📊 Trade Payroll & Daily Burn Rate (ETB / ብር)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trades.map((t) => {
                const tradeWorkers = workers.filter((w) => w.trade === t.trade);
                const dailyTotal = tradeWorkers.reduce((sum, w) => sum + w.dailyWage, 0);
                const avgWage =
                  tradeWorkers.length > 0 ? Math.round(dailyTotal / tradeWorkers.length) : 0;

                return (
                  <div
                    key={t.trade}
                    className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{t.trade}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-700 text-xs text-slate-300">
                        {t.count} workers
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/40">
                      <span>Daily Burn:</span>
                      <span className="text-amber-400 font-bold">{dailyTotal.toLocaleString()} ETB</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Avg. Daily Rate:</span>
                      <span className="text-slate-300 font-semibold">{avgWage.toLocaleString()} ETB</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SITE ALLOCATIONS */}
      {activeTab === "deployments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => {
            const assigned = workers.filter((w) =>
              w.assignments.some((a) => a.project.id === p.id)
            );
            const activeCount = assigned.filter((w) => w.isActive).length;
            const siteDailyPayroll = assigned.reduce((sum, w) => sum + w.dailyWage, 0);

            return (
              <div
                key={p.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold font-mono">
                      {p.code}
                    </span>
                    <span className="text-xs text-slate-400">
                      {activeCount} Active Personnel
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-2">{p.name}</h3>

                  <div className="mt-4 space-y-1.5">
                    <div className="text-xs font-semibold text-slate-400 uppercase">Assigned Staff</div>
                    {assigned.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">No workers assigned to this site yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {assigned.map((w) => (
                          <span
                            key={w.id}
                            className="px-2 py-0.5 rounded-md bg-slate-800 text-xs text-slate-300 border border-slate-700"
                          >
                            {w.fullName} ({w.trade})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500">Est. Daily Site Labor</div>
                    <div className="text-sm font-bold text-amber-400">
                      {siteDailyPayroll.toLocaleString()} ETB / day
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setRollCallProject(p.id);
                      setActiveTab("attendance");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold text-amber-300 transition"
                  >
                    Roll Call →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: REGISTER WORKER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>➕ Register New Worker</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateWorker} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Abebe Kebede"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    National ID / Fayda / Badge
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ETH-94827"
                    value={formData.nationalId}
                    onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0911000000"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Trade / Skill <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.trade}
                    onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {COMMON_TRADES.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Daily Wage (ETB / ብር) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="10"
                    placeholder="e.g. 450"
                    value={formData.dailyWage}
                    onChange={(e) => setFormData({ ...formData, dailyWage: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Assign to Initial Project Site (Optional)
                </label>
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- No initial assignment --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Worker"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT WORKER */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>✏️ Edit Worker Details</span>
              </h3>
              <button
                onClick={() => setEditingWorker(null)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditWorker} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.fullName}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, fullName: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    National ID / Fayda / Badge
                  </label>
                  <input
                    type="text"
                    value={editFormData.nationalId}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, nationalId: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editFormData.phoneNumber}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, phoneNumber: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Trade / Skill <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editFormData.trade}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, trade: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {COMMON_TRADES.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Daily Wage (ETB / ብር) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="10"
                    value={editFormData.dailyWage}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, dailyWage: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editFormData.isActive}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-amber-500"
                />
                <label htmlFor="editIsActive" className="text-sm text-slate-300 font-medium">
                  Active & Available for Site Duty
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingWorker(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Update Worker"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN WORKER TO SITE */}
      {assignModalWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🏗️ Assign Worker to Project Site</span>
              </h3>
              <button
                onClick={() => setAssignModalWorker(null)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAssignWorker} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Worker</label>
                <div className="px-3.5 py-2 rounded-xl bg-slate-800 text-sm font-semibold text-slate-200">
                  {assignModalWorker.fullName} ({assignModalWorker.trade})
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Target Construction Project <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={assignProjectId}
                  onChange={(e) => setAssignProjectId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssignModalWorker(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 disabled:opacity-50"
                >
                  {submitting ? "Assigning..." : "Confirm Site Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
