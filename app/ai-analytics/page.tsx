"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface ProjectAnalysis {
  id: string;
  name: string;
  code: string;
  budget: number;
  totalSpent: number;
  spendRatio: number;
  taskProgress: number;
  overdueTasks: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  predictedDelayDays: number;
  predictedCostOverrunPct: number;
  workerCount: number;
  recommendation: string;
}

interface AiPredictionItem {
  id: string;
  predictionType: string;
  predictedValue: number;
  confidence: number;
  riskLevel: string;
  insights: string;
  generatedAt: string;
  project: { name: string; code: string; budget: number };
}

export default function AiAnalyticsPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [riskSummary, setRiskSummary] = useState<any>({ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 });
  const [projectAnalysis, setProjectAnalysis] = useState<ProjectAnalysis[]>([]);
  const [recentPredictions, setRecentPredictions] = useState<AiPredictionItem[]>([]);
  const [runningScanId, setRunningScanId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/ai/overview");
      if (!res.ok) throw new Error("Failed to load AI overview");
      const data = await res.json();
      setRiskSummary(data.riskSummary || {});
      setProjectAnalysis(data.projectAnalysis || []);
      setRecentPredictions(data.recentPredictions || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  const handleRunAiScan = async (projectId: string) => {
    try {
      setRunningScanId(projectId);
      const res = await fetch("/api/ai/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("AI prediction failed");
      await fetchData();
      alert("✨ AI Neural Diagnostic & Risk Forecaster executed successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRunningScanId(null);
    }
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 text-white shadow-lg shadow-fuchsia-500/25 animate-pulse">
                🧠
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-fuchsia-400 bg-clip-text text-transparent">
                Artificial Intelligence & Predictive Analytics
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              AI-driven cost overrun forecasting, milestone delay detection, resource allocation optimizer, and risk diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300">
              <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-ping"></span>
              AI Engine Active
            </span>
          </div>
        </div>

        {/* Risk Breakdown Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/30 backdrop-blur-sm shadow-xl">
            <div className="text-xs font-bold text-rose-400 uppercase flex items-center justify-between">
              <span>Critical Risk</span>
              <span>🚨</span>
            </div>
            <div className="text-3xl font-black mt-2 text-rose-400">{riskSummary.CRITICAL || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Requires immediate intervention</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 backdrop-blur-sm shadow-xl">
            <div className="text-xs font-bold text-amber-400 uppercase flex items-center justify-between">
              <span>High Risk</span>
              <span>⚠️</span>
            </div>
            <div className="text-3xl font-black mt-2 text-amber-400">{riskSummary.HIGH || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Cost / schedule slip expected</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-blue-500/30 backdrop-blur-sm shadow-xl">
            <div className="text-xs font-bold text-blue-400 uppercase flex items-center justify-between">
              <span>Medium Risk</span>
              <span>⚡</span>
            </div>
            <div className="text-3xl font-black mt-2 text-blue-400">{riskSummary.MEDIUM || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Minor variances detected</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 backdrop-blur-sm shadow-xl">
            <div className="text-xs font-bold text-emerald-400 uppercase flex items-center justify-between">
              <span>Low Risk / Healthy</span>
              <span>✅</span>
            </div>
            <div className="text-3xl font-black mt-2 text-emerald-400">{riskSummary.LOW || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Operating on plan</div>
          </div>
        </div>

        {/* Real-time Project AI Forecaster Cards */}
        <div className="mt-8 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🔮 Project AI Predictive Diagnostics</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projectAnalysis.map((p) => (
              <div
                key={p.id}
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl flex flex-col justify-between relative overflow-hidden"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">{p.name}</h3>
                      <div className="text-xs text-slate-400">{p.code} • {p.workerCount} Workers Assigned</div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        p.riskLevel === "CRITICAL"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : p.riskLevel === "HIGH"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : p.riskLevel === "MEDIUM"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {p.riskLevel} RISK
                    </span>
                  </div>

                  {/* Prediction KPIs */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center">
                    <div>
                      <div className="text-[11px] text-slate-400">Pred. Cost Overrun</div>
                      <div className="text-base font-bold text-amber-300 mt-0.5">
                        +{p.predictedCostOverrunPct}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Pred. Delay</div>
                      <div className="text-base font-bold text-rose-300 mt-0.5">
                        +{p.predictedDelayDays} Days
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Progress vs Spend</div>
                      <div className="text-base font-bold text-cyan-300 mt-0.5">
                        {p.taskProgress}% / {p.spendRatio}%
                      </div>
                    </div>
                  </div>

                  {/* Recommendation Box */}
                  <div className="p-3.5 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-xs text-fuchsia-200 leading-relaxed">
                    <strong className="text-fuchsia-300">💡 AI Recommendation: </strong>
                    {p.recommendation}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {p.overdueTasks > 0 ? `⚠️ ${p.overdueTasks} Overdue Tasks` : "✅ Tasks on track"}
                  </span>
                  <button
                    onClick={() => handleRunAiScan(p.id)}
                    disabled={runningScanId === p.id}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-semibold text-xs shadow-lg shadow-fuchsia-600/20 transition"
                  >
                    {runningScanId === p.id ? "Running Diagnostic..." : "⚡ Run AI Scan"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Historical AI Prediction Logs */}
        <div className="mt-8 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span>📜 AI Diagnostics & Forecaster Audit Log</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase font-semibold text-slate-400">
                  <th className="py-3 px-3">Date Generated</th>
                  <th className="py-3 px-3">Project</th>
                  <th className="py-3 px-3">Prediction Type</th>
                  <th className="py-3 px-3">Predicted Value</th>
                  <th className="py-3 px-3">Confidence</th>
                  <th className="py-3 px-3">Insights</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentPredictions.map((pred) => (
                  <tr key={pred.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 text-slate-400 text-xs">
                      {new Date(pred.generatedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      {pred.project.name} ({pred.project.code})
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-xs text-fuchsia-300 font-semibold border border-slate-700">
                        {pred.predictionType}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-white">
                      {pred.predictedValue} {pred.predictionType.includes("DELAY") ? "Days" : "%"}
                    </td>
                    <td className="py-3 px-3 text-slate-300 text-xs font-semibold">
                      {(pred.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-3 text-slate-300 text-xs max-w-md truncate">
                      {pred.insights}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
}
