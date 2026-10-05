"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Project {
  id: string;
  name: string;
  code: string;
  location: string;
  workforce: {
    worker: { id: string; fullName: string; trade: string; dailyWage: number };
  }[];
  tasks: { id: string; name: string; status: string; dueDate: string }[];
}

interface DailyReport {
  id: string;
  date: string;
  workSummary: string;
  weatherCondition: string | null;
  issues: string | null;
  project: { id: string; name: string; code: string };
}

interface Material {
  id: string;
  name: string;
  unit: string;
  quantity: number;
}

export default function SiteEngineerPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [activeTab, setActiveTab] = useState<"REPORTS" | "ATTENDANCE" | "REQUESTS" | "TASKS">("REPORTS");

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Report Form
  const [reportForm, setReportForm] = useState({
    date: new Date().toISOString().split("T")[0],
    workSummary: "",
    weatherCondition: "Sunny / Clear",
    issues: "",
  });
  const [submittingReport, setSubmittingReport] = useState(false);

  // Attendance Form
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<{ [workerId: string]: string }>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Material Request Form
  const [requestNotes, setRequestNotes] = useState("");
  const [requestItems, setRequestItems] = useState<{ materialId: string; quantityRequested: number }[]>([
    { materialId: "", quantityRequested: 10 },
  ]);
  const [submittingReq, setSubmittingReq] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/site-engineer/overview");
      if (!res.ok) throw new Error("Failed to load site engineer overview");
      const data = await res.json();
      setProjects(data.projects || []);
      setReports(data.myReports || []);
      setMaterials(data.materials || []);

      if (data.projects && data.projects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data.projects[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load site data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Initialize attendance records when project changes
  useEffect(() => {
    if (activeProject?.workforce) {
      const init: { [workerId: string]: string } = {};
      activeProject.workforce.forEach((w) => {
        init[w.worker.id] = "PRESENT";
      });
      setAttendanceRecords(init);
    }
  }, [selectedProjectId, projects]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !reportForm.workSummary) return;
    try {
      setSubmittingReport(true);
      const res = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          date: reportForm.date,
          workSummary: reportForm.workSummary,
          weatherCondition: reportForm.weatherCondition,
          issues: reportForm.issues,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit daily report");
      setReportForm({
        date: new Date().toISOString().split("T")[0],
        workSummary: "",
        weatherCondition: "Sunny / Clear",
        issues: "",
      });
      fetchData();
      alert("✅ Daily report submitted successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedProjectId) return;
    try {
      setSavingAttendance(true);
      const records = Object.entries(attendanceRecords).map(([workerId, status]) => ({
        workerId,
        status,
        hoursWorked: status === "HALF_DAY" ? 4.0 : status === "PRESENT" ? 8.0 : 0,
      }));

      const res = await fetch("/api/attendances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          date: attendanceDate,
          records,
        }),
      });

      if (!res.ok) throw new Error("Failed to record attendance");
      alert("✅ Attendance recorded successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleAddRequestItem = () => {
    setRequestItems([...requestItems, { materialId: materials[0]?.id || "", quantityRequested: 5 }]);
  };

  const handleRemoveRequestItem = (idx: number) => {
    setRequestItems(requestItems.filter((_, i) => i !== idx));
  };

  const handleSubmitMaterialRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    const validItems = requestItems.filter((it) => it.materialId && it.quantityRequested > 0);
    if (validItems.length === 0) {
      alert("Please select at least one material and quantity");
      return;
    }

    try {
      setSubmittingReq(true);
      const res = await fetch("/api/material-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          notes: requestNotes,
          items: validItems,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit material request");
      setRequestNotes("");
      setRequestItems([{ materialId: materials[0]?.id || "", quantityRequested: 10 }]);
      alert("✅ Material requisition request submitted for PM review!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingReq(false);
    }
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                📐
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
                Site Engineer & Daily Field Operations
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Submit daily progress logs, record field worker attendance, and request construction materials.
            </p>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 uppercase">Active Site:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-medium text-white focus:ring-2 focus:ring-cyan-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 mt-6 gap-2">
          <button
            onClick={() => setActiveTab("REPORTS")}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "REPORTS"
                ? "border-cyan-500 text-cyan-400 bg-cyan-500/10 rounded-t-xl"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📝 Daily Progress Logs</span>
          </button>
          <button
            onClick={() => setActiveTab("ATTENDANCE")}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "ATTENDANCE"
                ? "border-cyan-500 text-cyan-400 bg-cyan-500/10 rounded-t-xl"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>✅ Site Attendance</span>
          </button>
          <button
            onClick={() => setActiveTab("REQUESTS")}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "REQUESTS"
                ? "border-cyan-500 text-cyan-400 bg-cyan-500/10 rounded-t-xl"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📦 Requisition Materials</span>
          </button>
          <button
            onClick={() => setActiveTab("TASKS")}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "TASKS"
                ? "border-cyan-500 text-cyan-400 bg-cyan-500/10 rounded-t-xl"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🎯 Active Site Tasks</span>
          </button>
        </div>

        {/* TAB 1: DAILY REPORTS */}
        {activeTab === "REPORTS" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
            {/* Form */}
            <div className="lg:col-span-1 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <span>✍️ Submit Daily Field Report</span>
              </h2>

              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={reportForm.date}
                    onChange={(e) => setReportForm({ ...reportForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Weather Condition</label>
                  <select
                    value={reportForm.weatherCondition}
                    onChange={(e) => setReportForm({ ...reportForm, weatherCondition: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="Sunny / Clear">☀️ Sunny / Clear</option>
                    <option value="Cloudy">⛅ Cloudy</option>
                    <option value="Light Rain">🌦️ Light Rain</option>
                    <option value="Heavy Rain / Storm">⛈️ Heavy Rain / Storm</option>
                    <option value="High Winds / Dusty">💨 High Winds / Dusty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Daily Work Completed *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe activities completed, concrete poured, masonry done, floors installed..."
                    value={reportForm.workSummary}
                    onChange={(e) => setReportForm({ ...reportForm, workSummary: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Issues, Delays or Safety Hazards</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Material shortage, equipment breakdown, inspection delay..."
                    value={reportForm.issues}
                    onChange={(e) => setReportForm({ ...reportForm, issues: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={submittingReport}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20"
                >
                  {submittingReport ? "Submitting Log..." : "Submit Daily Report"}
                </button>
              </form>
            </div>

            {/* List */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center justify-between">
                <span>📜 Recent Site Reports</span>
                <span className="text-xs text-slate-400">{reports.length} reports logged</span>
              </h2>

              {reports.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm bg-slate-900/40 rounded-2xl border border-slate-800">
                  No daily reports recorded yet. Submit your first site log above!
                </div>
              ) : (
                reports.map((r) => (
                  <div
                    key={r.id}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm shadow-lg hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-cyan-400 text-sm">{r.project.code}</span>
                        <span className="text-xs text-slate-400">• {new Date(r.date).toLocaleDateString()}</span>
                      </div>
                      {r.weatherCondition && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-xs text-slate-300 font-medium">
                          {r.weatherCondition}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {r.workSummary}
                    </p>
                    {r.issues && (
                      <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                        <span>⚠️</span>
                        <div>
                          <strong>Site Bottleneck: </strong>
                          {r.issues}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ATTENDANCE */}
        {activeTab === "ATTENDANCE" && (
          <div className="mt-6 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Field Worker Attendance - {activeProject?.name} ({activeProject?.code})
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Mark daily attendance for workers assigned to this site.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                />
                <button
                  onClick={handleSaveAttendance}
                  disabled={savingAttendance}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20"
                >
                  {savingAttendance ? "Saving..." : "💾 Save Attendance"}
                </button>
              </div>
            </div>

            {(!activeProject?.workforce || activeProject.workforce.length === 0) ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                No workers currently assigned to this project. Assign workers via the HR Module first.
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase font-semibold text-slate-400">
                      <th className="py-3 px-3">Worker</th>
                      <th className="py-3 px-3">Trade</th>
                      <th className="py-3 px-3">Daily Wage</th>
                      <th className="py-3 px-3 text-center">Attendance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeProject.workforce.map((w) => (
                      <tr key={w.worker.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-semibold text-white">{w.worker.fullName}</td>
                        <td className="py-3 px-3 text-slate-400">{w.worker.trade}</td>
                        <td className="py-3 px-3 text-slate-300 font-medium">${w.worker.dailyWage}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-2">
                            {(["PRESENT", "HALF_DAY", "ABSENT", "LEAVE"] as const).map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() =>
                                  setAttendanceRecords({ ...attendanceRecords, [w.worker.id]: st })
                                }
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                  attendanceRecords[w.worker.id] === st
                                    ? st === "PRESENT"
                                      ? "bg-emerald-500 text-white"
                                      : st === "HALF_DAY"
                                      ? "bg-amber-500 text-white"
                                      : st === "ABSENT"
                                      ? "bg-rose-500 text-white"
                                      : "bg-purple-500 text-white"
                                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                }`}
                              >
                                {st === "PRESENT"
                                  ? "Present (8h)"
                                  : st === "HALF_DAY"
                                  ? "Half Day (4h)"
                                  : st === "ABSENT"
                                  ? "Absent (0h)"
                                  : "Leave"}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MATERIAL REQUESTS */}
        {activeTab === "REQUESTS" && (
          <div className="mt-6 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl max-w-3xl mx-auto">
            <h2 className="text-lg font-bold text-white mb-2">
              📦 Site Material Requisition Request
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Request materials needed on site. Requests will be submitted directly to Project Managers and Store Keepers for approval.
            </p>

            <form onSubmit={handleSubmitMaterialRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Project</label>
                <input
                  type="text"
                  disabled
                  value={`${activeProject?.name} (${activeProject?.code})`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-sm text-slate-300"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-400">Required Materials & Quantities</label>
                  <button
                    type="button"
                    onClick={handleAddRequestItem}
                    className="text-xs text-cyan-400 hover:underline font-semibold"
                  >
                    + Add Material
                  </button>
                </div>

                <div className="space-y-3">
                  {requestItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <select
                        value={item.materialId}
                        onChange={(e) => {
                          const updated = [...requestItems];
                          updated[idx].materialId = e.target.value;
                          setRequestItems(updated);
                        }}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">-- Select Material --</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.unit}) - In Stock: {m.quantity}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        placeholder="Quantity"
                        value={item.quantityRequested}
                        onChange={(e) => {
                          const updated = [...requestItems];
                          updated[idx].quantityRequested = parseInt(e.target.value) || 0;
                          setRequestItems(updated);
                        }}
                        className="w-28 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-cyan-500"
                      />

                      {requestItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRequestItem(idx)}
                          className="text-rose-400 hover:text-rose-300 font-bold px-2 py-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Reason / Site Urgency Notes</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Required for slab casting scheduled for this Thursday..."
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={submittingReq}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20"
              >
                {submittingReq ? "Submitting Request..." : "Submit Material Requisition"}
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: TASKS */}
        {activeTab === "TASKS" && (
          <div className="mt-6 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4">
              🎯 Active Tasks for {activeProject?.name}
            </h2>
            {(!activeProject?.tasks || activeProject.tasks.length === 0) ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No active tasks logged for this site.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeProject.tasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-slate-800/70 border border-slate-700 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            t.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : t.status === "IN_PROGRESS"
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {t.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          Due: {new Date(t.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-100 text-sm">{t.name}</h4>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  );
}
