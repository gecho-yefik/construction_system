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
    project: { id: string; name: string; code: string; status: string };
  }[];
  _count: {
    attendances: number;
  };
}

interface Project {
  id: string;
  name: string;
  code: string;
  _count: { workforce: number };
}

interface TradeCount {
  trade: string;
  count: number;
}

export default function HRManagerPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<any>({
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

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("ALL");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("ALL");

  // Modal: Add Worker
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

  // Modal: Assign Worker
  const [assignModalWorker, setAssignModalWorker] = useState<Worker | null>(null);
  const [assignProjectId, setAssignProjectId] = useState("");

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

  const filteredWorkers = workers.filter((w) => {
    const matchesSearch =
      w.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.nationalId && w.nationalId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (w.phoneNumber && w.phoneNumber.includes(searchTerm));

    const matchesTrade = selectedTrade === "ALL" || w.trade === selectedTrade;

    const matchesProject =
      selectedProjectFilter === "ALL" ||
      w.assignments.some((a) => a.project.id === selectedProjectFilter);

    return matchesSearch && matchesTrade && matchesProject;
  });

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20">
                👥
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-400 bg-clip-text text-transparent">
                Human Resources & Workforce Module
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Manage labor force, skilled trades, daily wages, project assignments, and attendance logs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium text-sm shadow-lg shadow-amber-500/25 transition duration-200"
            >
              <span>➕ Register Worker</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm shadow-xl">
            <div className="text-xs font-semibold uppercase text-slate-400">Total Workforce</div>
            <div className="text-2xl font-black mt-2 text-white">{metrics.totalWorkers}</div>
            <div className="text-xs text-slate-500 mt-1">Registered personnel</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/20 backdrop-blur-sm shadow-xl">
            <div className="text-xs font-semibold uppercase text-emerald-400">Active Workers</div>
            <div className="text-2xl font-black mt-2 text-emerald-400">{metrics.activeWorkers}</div>
            <div className="text-xs text-slate-500 mt-1">Ready for site work</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-blue-500/20 backdrop-blur-sm shadow-xl">
            <div className="text-xs font-semibold uppercase text-blue-400">Present Today</div>
            <div className="text-2xl font-black mt-2 text-blue-400">{metrics.presentToday}</div>
            <div className="text-xs text-slate-500 mt-1">On duty across sites</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/20 backdrop-blur-sm shadow-xl">
            <div className="text-xs font-semibold uppercase text-rose-400">Absent Today</div>
            <div className="text-2xl font-black mt-2 text-rose-400">{metrics.absentToday}</div>
            <div className="text-xs text-slate-500 mt-1">Reported absent</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/20 backdrop-blur-sm shadow-xl">
            <div className="text-xs font-semibold uppercase text-purple-400">Active Sites</div>
            <div className="text-2xl font-black mt-2 text-purple-400">{metrics.activeProjectsCount}</div>
            <div className="text-xs text-slate-500 mt-1">Staffed projects</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 backdrop-blur-sm shadow-xl">
            <div className="text-xs font-semibold uppercase text-amber-400">Est. Daily Labor</div>
            <div className="text-2xl font-black mt-2 text-amber-400">
              ${(metrics.todayLaborCost || 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">Today's payroll est.</div>
          </div>
        </div>

        {/* Trade Distribution & Filter Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-8">
          {/* Trade Classification Card */}
          <div className="lg:col-span-1 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-sm">
            <h2 className="text-base font-bold text-slate-200 mb-3 flex items-center gap-2">
              <span>🛠️ Trade Distribution</span>
            </h2>
            <div className="space-y-2">
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

          {/* Worker Roster Table */}
          <div className="lg:col-span-3 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-sm flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <span>📋 Workforce Directory</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                  {filteredWorkers.length} workers
                </span>
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search by name, ID, phone..."
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
                      <th className="py-3 px-3">Worker Name</th>
                      <th className="py-3 px-3">Trade / Role</th>
                      <th className="py-3 px-3">Daily Wage</th>
                      <th className="py-3 px-3">Assigned Projects</th>
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
                          ${w.dailyWage.toLocaleString()} <span className="text-xs text-slate-500">/day</span>
                        </td>
                        <td className="py-3 px-3">
                          {w.assignments.length === 0 ? (
                            <span className="text-xs text-slate-500 italic">Unassigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {w.assignments.map((a) => (
                                <span
                                  key={a.project.id}
                                  className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs"
                                >
                                  {a.project.code}
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
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {w.isActive ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setAssignModalWorker(w);
                              setAssignProjectId(projects[0]?.id || "");
                            }}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
                          >
                            Assign Site
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Register Worker Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>➕ Register New Construction Worker</span>
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateWorker} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abebe Bekele"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">National ID</label>
                    <input
                      type="text"
                      placeholder="e.g. ETH-9842"
                      value={formData.nationalId}
                      onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +251 911 234567"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Trade / Specialization *</label>
                    <select
                      value={formData.trade}
                      onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Mason">Mason</option>
                      <option value="Carpenter">Carpenter</option>
                      <option value="Electrician">Electrician</option>
                      <option value="Plumber">Plumber</option>
                      <option value="Steel Fixer">Steel Fixer</option>
                      <option value="Painter">Painter</option>
                      <option value="Heavy Equipment Operator">Heavy Equipment Operator</option>
                      <option value="General Laborer">General Laborer</option>
                      <option value="Site Foreman">Site Foreman</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Daily Wage ($) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="10"
                      value={formData.dailyWage}
                      onChange={(e) => setFormData({ ...formData, dailyWage: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Initial Project Assignment</label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Assign Later --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-sm font-semibold shadow-lg shadow-amber-500/20"
                  >
                    {submitting ? "Registering..." : "Save Worker"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Worker Modal */}
        {assignModalWorker && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">
                Assign {assignModalWorker.fullName} to Project
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Trade: {assignModalWorker.trade} • Daily Wage: ${assignModalWorker.dailyWage}
              </p>

              <form onSubmit={handleAssignWorker} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Select Construction Project</label>
                  <select
                    value={assignProjectId}
                    onChange={(e) => setAssignProjectId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-500"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAssignModalWorker(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                  >
                    {submitting ? "Assigning..." : "Confirm Assignment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
