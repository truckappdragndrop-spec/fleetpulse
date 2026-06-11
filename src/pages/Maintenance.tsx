import { useState } from "react";
import { useCollection } from "@/hooks/useCollection";
import {
  Plus, Search, Pencil, Trash2, X, AlertTriangle,
  CheckCircle2, Clock, Wrench,
} from "lucide-react";
import type { Timestamp } from "firebase/firestore";

interface MaintDoc {
  id: string; truckId: string; fleetId: string; truckBrand: string; truckModel: string;
  maintenanceType: string; title: string; description?: string;
  scheduledDate: string; completedDate?: string; scheduledKm?: string; cost?: string;
  provider?: string; status: string; priority: string; createdAt: Timestamp;
}

interface TruckDoc { id: string; fleetId: string; brand: string; model: string; status: string; createdAt: Timestamp; }

const maintTypes: Record<string, string> = {
  oil_change: "Oil Change", tire_inspection: "Tire Inspection", brake_check: "Brake Check",
  engine_tuneup: "Engine Tune-up", filter_replacement: "Filter Replacement",
  electrical: "Electrical", suspension: "Suspension", transmission: "Transmission",
  cooling_system: "Cooling System", other: "Other",
};

const priColors: Record<string, string> = { low: "var(--accent-green)", medium: "var(--accent-amber)", high: "var(--accent-orange)", critical: "var(--accent-red)" };
const priLabels: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const statLabels: Record<string, string> = { pending: "Pending", in_progress: "In Progress", completed: "Completed", overdue: "Overdue", cancelled: "Cancelled" };
const statColors: Record<string, string> = { pending: "var(--accent-amber)", in_progress: "var(--accent-amber)", completed: "var(--accent-green)", overdue: "var(--accent-red)", cancelled: "var(--text-muted)" };

export default function Maintenance() {
  const { data: records, isLoading, create, update, remove } = useCollection<MaintDoc>("maintenance");
  const { data: trucks } = useCollection<TruckDoc>("trucks");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ truckId: "", fleetId: "", maintenanceType: "oil_change", title: "", description: "", scheduledDate: "", scheduledKm: "", cost: "", provider: "", priority: "medium" });

  const resetForm = () => setForm({ truckId: "", fleetId: "", maintenanceType: "oil_change", title: "", description: "", scheduledDate: "", scheduledKm: "", cost: "", provider: "", priority: "medium" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.truckId || !form.title || !form.scheduledDate) return;
    const truck = trucks.find((t) => t.id === form.truckId);
    const payload = { ...form, fleetId: truck?.fleetId || "", truckBrand: truck?.brand || "", truckModel: truck?.model || "" };
    if (editingId) { await update(editingId, payload); }
    else { await create({ ...payload, status: "pending" }); }
    setModalOpen(false); setEditingId(null); resetForm();
  };

  const handleEdit = (r: MaintDoc) => { setEditingId(r.id); setForm({ truckId: r.truckId, fleetId: r.fleetId || "", maintenanceType: r.maintenanceType, title: r.title, description: r.description || "", scheduledDate: r.scheduledDate, scheduledKm: r.scheduledKm || "", cost: r.cost || "", provider: r.provider || "", priority: r.priority }); setModalOpen(true); };
  const handleDelete = async (id: string) => { if (confirm("Delete this record?")) await remove(id); };
  const handleComplete = async (id: string) => { await update(id, { status: "completed", completedDate: new Date().toISOString().split("T")[0] }); };
  const handleStart = async (id: string) => { await update(id, { status: "in_progress" }); };

  const today = new Date().toISOString().split("T")[0];
  const filtered = records.filter((r) => {
    const mSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.fleetId?.toLowerCase().includes(search.toLowerCase());
    const mStatus = !statusFilter || r.status === statusFilter;
    return mSearch && mStatus;
  });

  const overdue = records.filter((r) => r.status === "overdue" || (r.status === "pending" && r.scheduledDate <= today));
  const pending = records.filter((r) => r.status === "pending");
  const completed = records.filter((r) => r.status === "completed");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Maintenance</h1><p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Schedule and track maintenance</p></div>
        <button onClick={() => { resetForm(); setEditingId(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> New Maintenance</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(232, 168, 56, 0.1)" }}><Clock size={20} style={{ color: "var(--accent-amber)" }} /></div><div><p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{pending.length}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Pending</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(184, 64, 64, 0.1)" }}><AlertTriangle size={20} style={{ color: "var(--accent-red)" }} /></div><div><p className="text-lg font-semibold" style={{ color: "var(--accent-red)" }}>{overdue.length}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Overdue</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(74, 155, 106, 0.1)" }}><CheckCircle2 size={20} style={{ color: "var(--accent-green)" }} /></div><div><p className="text-lg font-semibold" style={{ color: "var(--accent-green)" }}>{completed.length}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Completed</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(232, 168, 56, 0.1)" }}><Wrench size={20} style={{ color: "var(--accent-amber)" }} /></div><div><p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{records.length}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Total</p></div></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search maintenance..." className="glass-input w-full pl-10" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="glass-input" style={{ color: "var(--text-primary)", minWidth: 160 }}><option value="">All statuses</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="overdue">Overdue</option></select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Truck</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Type</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Title</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Priority</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
              <th className="text-right px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Actions</th>
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="text-center py-8"><div className="inline-block w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} /></td></tr>
              : filtered.length > 0 ? filtered.map((r) => (
                <tr key={r.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <td className="px-5 py-4"><span className="mono-font text-sm font-medium" style={{ color: "var(--accent-amber)" }}>{r.fleetId}</span><p className="text-xs" style={{ color: "var(--text-muted)" }}>{r.truckBrand} {r.truckModel}</p></td>
                  <td className="px-5 py-4"><span className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>{maintTypes[r.maintenanceType]}</span></td>
                  <td className="px-5 py-4 text-sm" style={{ color: "var(--text-primary)" }}>{r.title}</td>
                  <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>{r.scheduledDate}</td>
                  <td className="px-5 py-4"><span className="text-xs px-2 py-1 rounded-md" style={{ background: `${priColors[r.priority]}15`, color: priColors[r.priority] }}>{priLabels[r.priority]}</span></td>
                  <td className="px-5 py-4"><span className="text-xs px-2 py-1 rounded-md" style={{ background: `${statColors[r.status]}15`, color: statColors[r.status] }}>{statLabels[r.status]}</span></td>
                  <td className="px-5 py-4"><div className="flex items-center justify-end gap-1">
                    {r.status === "pending" && <button onClick={() => handleComplete(r.id)} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-green)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")} title="Complete"><CheckCircle2 size={16} /></button>}
                    <button onClick={() => handleEdit(r)} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-amber)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(r.id)} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-red)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}><Trash2 size={16} /></button>
                  </div></td>
                </tr>
              )) : <tr><td colSpan={7} className="text-center py-12" style={{ color: "var(--text-muted)" }}><Wrench size={48} className="mx-auto mb-3 opacity-30" /><p>No maintenance records found</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: "var(--bg-panel-solid)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{editingId ? "Edit Maintenance" : "New Maintenance"}</h2><button onClick={() => setModalOpen(false)} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Truck *</label>
                <select value={form.truckId} onChange={(e) => setForm({ ...form, truckId: e.target.value })} className="glass-input w-full" style={{ color: "var(--text-primary)" }} required>
                  <option value="">Select...</option>
                  {trucks.map((t) => <option key={t.id} value={t.id}>{t.fleetId} - {t.brand} {t.model}</option>)}
                </select></div>
              <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Type *</label>
                <select value={form.maintenanceType} onChange={(e) => setForm({ ...form, maintenanceType: e.target.value })} className="glass-input w-full" style={{ color: "var(--text-primary)" }}>
                  {Object.entries(maintTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="glass-input w-full" placeholder="e.g. 100k mile oil change" required /></div>
              <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="glass-input w-full" rows={3} placeholder="Maintenance details..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Scheduled Date *</label><input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="glass-input w-full" required /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Scheduled Miles</label><input value={form.scheduledKm} onChange={(e) => setForm({ ...form, scheduledKm: e.target.value })} className="glass-input w-full mono-font" placeholder="150000" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Estimated Cost ($)</label><input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="glass-input w-full mono-font" placeholder="1200.00" /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="glass-input w-full" style={{ color: "var(--text-primary)" }}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
              </div>
              <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Provider</label><input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="glass-input w-full" placeholder="Shop or provider name" /></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button><button type="submit" className="btn-primary">{editingId ? "Update" : "Schedule"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
