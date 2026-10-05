"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Material {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  reorderLevel: number;
}

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  _count: { purchaseOrders: number };
}

interface PurchaseOrder {
  id: string;
  supplier: { id: string; name: string; phone: string };
  totalAmount: number;
  status: "PENDING" | "ORDERED" | "DELIVERED" | "CANCELLED";
  orderedAt: string;
  items: { material: { name: string; unit: string }; quantity: number; unitPrice: number }[];
}

interface MaterialRequest {
  id: string;
  project: { id: string; name: string; code: string };
  requester: { name: string; email: string };
  status: string;
  notes: string | null;
  createdAt: string;
  items: { material: { id: string; name: string; unit: string; quantity: number }; quantityRequested: number }[];
}

export default function ProcurementOfficerPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>({});
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [pendingRequests, setPendingRequests] = useState<MaterialRequest[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; code: string }[]>([]);

  const [activeTab, setActiveTab] = useState<"INVENTORY" | "REQUISITIONS" | "SUPPLIERS" | "PURCHASE_ORDERS">("INVENTORY");

  // Add Material Modal
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [matForm, setMatForm] = useState({
    name: "",
    unit: "Bags",
    quantity: "50",
    unitPrice: "450",
    reorderLevel: "15",
  });

  // Add Supplier Modal
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [supForm, setSupForm] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
  });

  // Create PO Modal
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poItems, setPoItems] = useState<{ materialId: string; quantity: number; unitPrice: number }[]>([
    { materialId: "", quantity: 50, unitPrice: 400 },
  ]);

  // Issue Stock Modal
  const [issueModalReq, setIssueModalReq] = useState<MaterialRequest | null>(null);
  const [issuedToRecipient, setIssuedToRecipient] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/procurement-officer/overview");
      if (!res.ok) throw new Error("Failed to load procurement overview");
      const data = await res.json();
      setMetrics(data.metrics || {});
      setMaterials(data.materials || []);
      setSuppliers(data.suppliers || []);
      setPurchaseOrders(data.purchaseOrders || []);
      setPendingRequests(data.pendingRequests || []);
      setProjects(data.projects || []);

      if (data.suppliers && data.suppliers.length > 0 && !poSupplierId) {
        setPoSupplierId(data.suppliers[0].id);
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

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matForm),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed");
      }
      setShowAddMaterial(false);
      setMatForm({ name: "", unit: "Bags", quantity: "50", unitPrice: "450", reorderLevel: "15" });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supForm),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed");
      }
      setShowAddSupplier(false);
      setSupForm({ name: "", contactName: "", phone: "", email: "", address: "" });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: poSupplierId,
          items: poItems,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed");
      }
      setShowCreatePO(false);
      fetchData();
      alert("✅ Purchase Order created successfully!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdatePOStatus = async (poId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update PO status");
      fetchData();
      alert(`✅ Purchase Order marked as ${newStatus}!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleIssueStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueModalReq || !issuedToRecipient) return;
    try {
      const res = await fetch("/api/material-issuances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: issueModalReq.project.id,
          issuedTo: issuedToRecipient,
          items: issueModalReq.items.map((it) => ({
            materialId: it.material.id,
            quantityIssued: it.quantityRequested,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to issue materials");

      // Mark request fulfilled
      await fetch(`/api/material-requests/${issueModalReq.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FULFILLED" }),
      });

      setIssueModalReq(null);
      setIssuedToRecipient("");
      fetchData();
      alert("✅ Materials issued to site and deducted from warehouse inventory!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
                📦
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                Procurement & Store / Inventory Module
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Warehouse stock tracking, site requisition fulfillment, supplier database, and purchase order tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddMaterial(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-lg shadow-emerald-600/20"
            >
              + Add Material
            </button>
            <button
              onClick={() => setShowCreatePO(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium text-sm transition"
            >
              + Create Purchase Order
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
            <div className="text-xs font-semibold text-slate-400 uppercase">Catalog Items</div>
            <div className="text-2xl font-black mt-2 text-white">{metrics.totalMaterials || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Material SKU types</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/20 backdrop-blur-sm">
            <div className="text-xs font-semibold text-rose-400 uppercase">Low Stock Alerts</div>
            <div className="text-2xl font-black mt-2 text-rose-400">{metrics.lowStockCount || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Below reorder limit</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 backdrop-blur-sm">
            <div className="text-xs font-semibold text-amber-400 uppercase">Pending Requisitions</div>
            <div className="text-2xl font-black mt-2 text-amber-400">{metrics.pendingRequisitionsCount || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Awaiting dispatch</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-blue-500/20 backdrop-blur-sm">
            <div className="text-xs font-semibold text-blue-400 uppercase">Active Orders</div>
            <div className="text-2xl font-black mt-2 text-blue-400">{metrics.activeOrdersCount || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Pending/Ordered POs</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/20 backdrop-blur-sm">
            <div className="text-xs font-semibold text-purple-400 uppercase">Suppliers</div>
            <div className="text-2xl font-black mt-2 text-purple-400">{metrics.totalSuppliers || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Active vendor records</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/20 backdrop-blur-sm">
            <div className="text-xs font-semibold text-emerald-400 uppercase">Inventory Value</div>
            <div className="text-2xl font-black mt-2 text-emerald-400">
              ${(metrics.totalInventoryValue || 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">Warehouse assets</div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-800 mt-8 gap-2">
          <button
            onClick={() => setActiveTab("INVENTORY")}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "INVENTORY"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📊 Stock Inventory</span>
          </button>
          <button
            onClick={() => setActiveTab("REQUISITIONS")}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "REQUISITIONS"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🚚 Site Requisitions & Issuance ({pendingRequests.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("PURCHASE_ORDERS")}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "PURCHASE_ORDERS"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📑 Purchase Orders</span>
          </button>
          <button
            onClick={() => setActiveTab("SUPPLIERS")}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "SUPPLIERS"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🏢 Supplier Directory</span>
          </button>
        </div>

        {/* TAB 1: INVENTORY */}
        {activeTab === "INVENTORY" && (
          <div className="mt-6 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl">
            <h2 className="text-base font-bold text-white mb-4 flex items-center justify-between">
              <span>Warehouse Material Inventory</span>
              <span className="text-xs text-slate-400">{materials.length} items cataloged</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase font-semibold text-slate-400">
                    <th className="py-3 px-3">Material Name</th>
                    <th className="py-3 px-3">Unit</th>
                    <th className="py-3 px-3">In Stock</th>
                    <th className="py-3 px-3">Unit Price</th>
                    <th className="py-3 px-3">Reorder Threshold</th>
                    <th className="py-3 px-3">Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {materials.map((m) => {
                    const isLow = m.quantity <= m.reorderLevel;
                    return (
                      <tr key={m.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-semibold text-slate-200">{m.name}</td>
                        <td className="py-3 px-3 text-slate-400">{m.unit}</td>
                        <td className="py-3 px-3 font-bold text-white text-base">
                          {m.quantity.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-slate-300">${m.unitPrice}</td>
                        <td className="py-3 px-3 text-slate-400">{m.reorderLevel} {m.unit}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isLow
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {isLow ? "⚠️ Low Stock" : "✅ Sufficient"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: REQUISITIONS & ISSUANCE */}
        {activeTab === "REQUISITIONS" && (
          <div className="mt-6 space-y-4">
            <h2 className="text-base font-bold text-white">
              Site Material Requests Awaiting Warehouse Issuance
            </h2>

            {pendingRequests.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm bg-slate-900/60 rounded-2xl border border-slate-800">
                No pending material requisitions at this time.
              </div>
            ) : (
              pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400">{req.project.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {req.project.code}
                      </span>
                      <span className="text-xs text-slate-500">
                        Requested by: {req.requester.name} ({new Date(req.createdAt).toLocaleDateString()})
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {req.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200"
                        >
                          <strong>{it.material.name}:</strong> {it.quantityRequested} {it.material.unit}
                          <span className="text-slate-400 ml-2">(Warehouse: {it.material.quantity})</span>
                        </div>
                      ))}
                    </div>

                    {req.notes && (
                      <p className="text-xs text-slate-400 italic">"{req.notes}"</p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setIssueModalReq(req);
                      setIssuedToRecipient(req.requester.name || "Site Team");
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 whitespace-nowrap"
                  >
                    📦 Issue & Dispatch Stock
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: PURCHASE ORDERS */}
        {activeTab === "PURCHASE_ORDERS" && (
          <div className="mt-6 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl">
            <h2 className="text-base font-bold text-white mb-4">Procurement Purchase Orders</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase font-semibold text-slate-400">
                    <th className="py-3 px-3">Order ID / Date</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3">Items Ordered</th>
                    <th className="py-3 px-3">Total Amount</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">PO-{po.id.slice(-6)}</div>
                        <div className="text-xs text-slate-500">{new Date(po.orderedAt).toLocaleDateString()}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-medium">
                        {po.supplier.name}
                        <div className="text-xs text-slate-500">{po.supplier.phone}</div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-400">
                        {po.items.map((it, i) => (
                          <div key={i}>
                            {it.material.name} ({it.quantity} {it.material.unit})
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-400">${po.totalAmount.toLocaleString()}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            po.status === "DELIVERED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : po.status === "ORDERED"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {po.status !== "DELIVERED" && po.status !== "CANCELLED" && (
                          <div className="flex items-center justify-end gap-2">
                            {po.status === "PENDING" && (
                              <button
                                onClick={() => handleUpdatePOStatus(po.id, "ORDERED")}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white"
                              >
                                Mark Ordered
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdatePOStatus(po.id, "DELIVERED")}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white"
                            >
                              Receive Delivery
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: SUPPLIERS */}
        {activeTab === "SUPPLIERS" && (
          <div className="mt-6 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Vendor & Supplier Directory</h2>
              <button
                onClick={() => setShowAddSupplier(true)}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white"
              >
                + Add Supplier
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {suppliers.map((s) => (
                <div key={s.id} className="p-4 rounded-xl bg-slate-800/70 border border-slate-700">
                  <div className="font-bold text-slate-100 text-base">{s.name}</div>
                  {s.contactName && <div className="text-xs text-slate-400 mt-0.5">Rep: {s.contactName}</div>}
                  <div className="mt-3 space-y-1 text-xs text-slate-300">
                    <div>📞 {s.phone}</div>
                    {s.email && <div>✉️ {s.email}</div>}
                    {s.address && <div>📍 {s.address}</div>}
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-700/60 text-xs text-purple-400 font-semibold">
                    {s._count.purchaseOrders} Orders Placed
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: Add Material */}
        {showAddMaterial && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-4">Add Material to Catalog</h3>
              <form onSubmit={handleAddMaterial} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Material Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Portland Cement 42.5R"
                    value={matForm.name}
                    onChange={(e) => setMatForm({ ...matForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Unit *</label>
                    <input
                      type="text"
                      required
                      placeholder="Bags, Tons, M3..."
                      value={matForm.unit}
                      onChange={(e) => setMatForm({ ...matForm, unit: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Initial Stock</label>
                    <input
                      type="number"
                      required
                      value={matForm.quantity}
                      onChange={(e) => setMatForm({ ...matForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Unit Price ($) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={matForm.unitPrice}
                      onChange={(e) => setMatForm({ ...matForm, unitPrice: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Low Reorder Level</label>
                    <input
                      type="number"
                      required
                      value={matForm.reorderLevel}
                      onChange={(e) => setMatForm({ ...matForm, reorderLevel: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddMaterial(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                  >
                    Save Material
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Supplier */}
        {showAddSupplier && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-4">Register Supplier</h3>
              <form onSubmit={handleAddSupplier} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Company / Supplier Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dangote Cement PLC"
                    value={supForm.name}
                    onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Girma Tesfaye"
                    value={supForm.contactName}
                    onChange={(e) => setSupForm({ ...supForm, contactName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Phone *</label>
                    <input
                      type="text"
                      required
                      value={supForm.phone}
                      onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={supForm.email}
                      onChange={(e) => setSupForm({ ...supForm, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddSupplier(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold"
                  >
                    Save Supplier
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Issue Stock */}
        {issueModalReq && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Issue Material to Site</h3>
              <p className="text-xs text-slate-400 mb-4">
                Destination: {issueModalReq.project.name} ({issueModalReq.project.code})
              </p>
              <form onSubmit={handleIssueStock} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Received by (Site Engineer / Foreman Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={issuedToRecipient}
                    onChange={(e) => setIssuedToRecipient(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                  />
                </div>
                <div className="p-3 bg-slate-800/80 rounded-xl text-xs space-y-1 text-slate-300">
                  {issueModalReq.items.map((it, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{it.material.name}</span>
                      <strong>{it.quantityRequested} {it.material.unit}</strong>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIssueModalReq(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                  >
                    Confirm Dispatch
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
