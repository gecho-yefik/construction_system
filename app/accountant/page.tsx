"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface FinancialSummary {
  totalBudget: number;
  totalExpenses: number;
  remainingBudget: number;
  budgetUtilization: number;
  totalProjects: number;
  estimatedLaborFromAttendance: number;
}

interface CategoryExpense {
  category: string;
  totalAmount: number;
  transactionCount: number;
}

interface ProjectFinancial {
  id: string;
  name: string;
  code: string;
  status: string;
  budget: number;
  totalSpent: number;
  remaining: number;
  utilizationPct: number;
  isOverBudget: boolean;
  manager: { name: string | null; email: string | null } | null;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  expenseDate: string;
  project: { id: string; name: string; code: string; budget: number };
  recordedBy: { name: string | null; role: string };
}

export default function AccountantPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<FinancialSummary>({
    totalBudget: 0,
    totalExpenses: 0,
    remainingBudget: 0,
    budgetUtilization: 0,
    totalProjects: 0,
    estimatedLaborFromAttendance: 0,
  });

  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryExpense[]>([]);
  const [projectFinancials, setProjectFinancials] = useState<ProjectFinancial[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Add Expense Modal
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    projectId: "",
    category: "MATERIALS",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().split("T")[0],
  });
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Search & Filters
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("ALL");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/finance/overview");
      if (!res.ok) throw new Error("Failed to load financial overview");
      const data = await res.json();
      setSummary(data.summary || {});
      setCategoryBreakdown(data.categoryBreakdown || []);
      setProjectFinancials(data.projectFinancials || []);
      setExpenses(data.recentExpenses || []);

      if (data.projectFinancials && data.projectFinancials.length > 0 && !expenseForm.projectId) {
        setExpenseForm((prev) => ({ ...prev, projectId: data.projectFinancials[0].id }));
      }
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

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.projectId || !expenseForm.amount) return;
    try {
      setSubmittingExpense(true);
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expenseForm),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to log expense");
      }
      setShowAddExpense(false);
      setExpenseForm({
        projectId: projectFinancials[0]?.id || "",
        category: "MATERIALS",
        amount: "",
        description: "",
        expenseDate: new Date().toISOString().split("T")[0],
      });
      fetchData();
      alert("✅ Expense transaction recorded!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingExpense(false);
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    const matchesCategory =
      selectedCategoryFilter === "ALL" || e.category === selectedCategoryFilter;
    const matchesProject =
      selectedProjectFilter === "ALL" || e.project.id === selectedProjectFilter;
    return matchesCategory && matchesProject;
  });

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/20">
                💰
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                Financial Management & Cost Control
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Track project expenditures, compare planned budgets vs actual spend, audit ledgers, and reconcile labor and procurement costs.
            </p>
          </div>

          <button
            onClick={() => setShowAddExpense(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-medium text-sm shadow-lg shadow-emerald-500/20 transition"
          >
            + Record Expense
          </button>
        </div>

        {/* Executive Financial Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
            <div className="text-xs font-semibold text-slate-400 uppercase">Total Portfolio Budget</div>
            <div className="text-2xl font-black mt-2 text-white">
              ${(summary.totalBudget || 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">{summary.totalProjects} active projects</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 backdrop-blur-sm">
            <div className="text-xs font-semibold text-amber-400 uppercase">Actual Expenditure</div>
            <div className="text-2xl font-black mt-2 text-amber-400">
              ${(summary.totalExpenses || 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">Logged to date</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/20 backdrop-blur-sm">
            <div className="text-xs font-semibold text-emerald-400 uppercase">Remaining Balance</div>
            <div className="text-2xl font-black mt-2 text-emerald-400">
              ${(summary.remainingBudget || 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">Unspent capital</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-blue-500/20 backdrop-blur-sm">
            <div className="text-xs font-semibold text-blue-400 uppercase">Budget Burn Rate</div>
            <div className="text-2xl font-black mt-2 text-blue-400">
              {summary.budgetUtilization || 0}%
            </div>
            <div className="text-xs text-slate-500 mt-1">Portfolio utilization</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/20 backdrop-blur-sm">
            <div className="text-xs font-semibold text-purple-400 uppercase">Est. Labor Costs</div>
            <div className="text-2xl font-black mt-2 text-purple-400">
              ${(summary.estimatedLaborFromAttendance || 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">From daily site rosters</div>
          </div>
        </div>

        {/* Breakdown by Category & Project Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Category Breakdown */}
          <div className="lg:col-span-1 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <span>📊 Expenditure by Category</span>
            </h2>

            <div className="space-y-4">
              {categoryBreakdown.map((cat) => {
                const pct =
                  summary.totalExpenses > 0
                    ? Math.round((cat.totalAmount / summary.totalExpenses) * 100)
                    : 0;
                return (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300">{cat.category}</span>
                      <span className="text-slate-100">
                        ${cat.totalAmount.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          cat.category === "MATERIALS"
                            ? "bg-emerald-500"
                            : cat.category === "LABOR"
                            ? "bg-amber-500"
                            : cat.category === "EQUIPMENT"
                            ? "bg-cyan-500"
                            : cat.category === "LOGISTICS"
                            ? "bg-purple-500"
                            : "bg-slate-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {cat.transactionCount} transactions recorded
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Budget Variance Breakdown */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl">
            <h2 className="text-base font-bold text-white mb-4">
              Project Budget vs. Actual Expenditure
            </h2>

            <div className="space-y-4">
              {projectFinancials.map((pf) => (
                <div
                  key={pf.id}
                  className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{pf.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {pf.code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300">
                      Spent: <strong className="text-white">${pf.totalSpent.toLocaleString()}</strong> of $
                      {pf.budget.toLocaleString()}
                    </div>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pf.isOverBudget
                          ? "bg-rose-500"
                          : pf.utilizationPct > 80
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, pf.utilizationPct)}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Utilization: {pf.utilizationPct}%</span>
                    <span>
                      Remaining:{" "}
                      <strong className={pf.remaining < 0 ? "text-rose-400" : "text-emerald-400"}>
                        ${pf.remaining.toLocaleString()}
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <div className="mt-8 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>📑 Expense Ledger</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                {filteredExpenses.length} records
              </span>
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
              >
                <option value="ALL">All Categories</option>
                <option value="MATERIALS">MATERIALS</option>
                <option value="LABOR">LABOR</option>
                <option value="EQUIPMENT">EQUIPMENT</option>
                <option value="LOGISTICS">LOGISTICS</option>
                <option value="MISCELLANEOUS">MISCELLANEOUS</option>
              </select>

              <select
                value={selectedProjectFilter}
                onChange={(e) => setSelectedProjectFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
              >
                <option value="ALL">All Projects</option>
                {projectFinancials.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase font-semibold text-slate-400">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Project</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Recorded By</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 text-slate-400 text-xs">
                      {new Date(exp.expenseDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      {exp.project.name}
                      <span className="text-xs text-slate-500 ml-1">({exp.project.code})</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-xs font-semibold text-amber-400 border border-slate-700">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 text-xs">{exp.description || "-"}</td>
                    <td className="py-3 px-3 text-slate-400 text-xs">{exp.recordedBy?.name || "System"}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      ${exp.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Record Expense */}
        {showAddExpense && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-4">Record New Project Expense</h3>
              <form onSubmit={handleCreateExpense} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Project *</label>
                  <select
                    value={expenseForm.projectId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, projectId: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                  >
                    {projectFinancials.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Category *</label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                    >
                      <option value="MATERIALS">MATERIALS</option>
                      <option value="LABOR">LABOR</option>
                      <option value="EQUIPMENT">EQUIPMENT</option>
                      <option value="LOGISTICS">LOGISTICS</option>
                      <option value="MISCELLANEOUS">MISCELLANEOUS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Amount ($) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      placeholder="e.g. 15000"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Expense Date</label>
                  <input
                    type="date"
                    value={expenseForm.expenseDate}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Description / Notes</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Concrete supplier payment invoice #892"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddExpense(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingExpense}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                  >
                    {submittingExpense ? "Recording..." : "Save Expense"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
