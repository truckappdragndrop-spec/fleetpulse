import { useState } from "react";
import { useCollection } from "@/hooks/useCollection";
import { Plus, Search, Pencil, Trash2, X, Droplets, TrendingUp } from "lucide-react";
import type { Timestamp } from "firebase/firestore";

interface FuelDoc {
  id: string; truckId: string; fleetId: string; truckBrand: string; truckModel: string;
  driverName?: string; fuelDate: string; liters: string; pricePerLiter?: string;
  totalCost?: string; kmAtRefuel?: string; kmPrevious?: string; kmDriven?: string;
  efficiency?: string; stationName?: string; notes?: string; createdAt: Timestamp;
}

interface TruckDoc { id: string; fleetId: string; brand: string; model: string; currentKm: string; createdAt: Timestamp; }

export default function Fuel() {
  const { data: records, isLoading, create, update, remove } = useCollection<FuelDoc>("fuelRecords");
  const { data: trucks } = useCollection<TruckDoc>("trucks");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ truckId: "", driverName: "", fuelDate: new Date().toISOString().split("T")[0], liters: "", pricePerLiter: "", totalCost: "", kmAtRefuel: "", kmPrevious: "", stationName: "", notes: "" });

  const resetForm = () => setForm({ truckId: "", driverName: "", fuelDate: new Date().toISOString().split("T")[0], liters: "", pricePerLiter: "", totalCost: "", kmAtRefuel: "", kmPrevious: "", stationName: "", notes: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.truckId || !form.liters || !form.fuelDate) return;
    const gal = Number(form.liters);
    const miAt = form.kmAtRefuel ? Number(form.kmAtRefuel) : 0;
    const miPrev = form.kmPrevious ? Number(form.kmPrevious) : 0;
    const miDriven = miAt - miPrev;
    const mpg = miDriven > 0 ? (miDriven / gal).toFixed(1) : "0";
    const truck = trucks.find((t) => t.id === form.truckId);
    const payload = { ...form, fleetId: truck?.fleetId || "", truckBrand: truck?.brand || "", truckModel: truck?.model || "", kmDriven: miDriven > 0 ? String(miDriven) : "", efficiency: Number(mpg) > 0 ? mpg : "" };
    if (editingId) { await update(editingId, payload); }
    else { await create(payload); }
    setModalOpen(false); setEditingId(null); resetForm();
  };

  const handleEdit = (r: FuelDoc) => { setEditingId(r.id); setForm({ truckId: r.truckId, driverName: r.driverName || "", fuelDate: r.fuelDate, liters: String(r.liters), pricePerLiter: r.pricePerLiter || "", totalCost: r.totalCost || "", kmAtRefuel: r.kmAtRefuel || "", kmPrevious: r.kmPrevious || "", stationName: r.stationName || "", notes: r.notes || "" }); setModalOpen(true); };
  const handleDelete = async (id: string) => { if (confirm("Delete this record?")) await remove(id); };

  const filtered = records.filter((r) => !search || r.fleetId?.toLowerCase().includes(search.toLowerCase()) || r.driverName?.toLowerCase().includes(search.toLowerCase()));
  const totalGal = records.reduce((s, r) => s + Number(r.liters), 0);
  const totalCost = records.reduce((s, r) => s + Number(r.totalCost || 0), 0);
  const avgMPG = records.length > 0 ? (records.reduce((s, r) => s + (Number(r.efficiency) || 0), 0) / records.length).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Fuel Consumption</h1><p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Track fleet fuel usage</p></div>
        <button onClick={() => { resetForm(); setEditingId(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> New Refuel</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(232, 168, 56, 0.1)" }}><Droplets size={20} style={{ color: "var(--accent-amber)" }} /></div><div><p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>{totalGal.toLocaleString("en-US", { maximumFractionDigits: 0 })} gal</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Total refueled</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(212, 165, 32, 0.1)" }}><span className="text-lg" style={{ color: "var(--accent-gold)" }}>$</span></div><div><p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>{totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Total cost</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(74, 155, 106, 0.1)" }}><TrendingUp size={20} style={{ color: "var(--accent-green)" }} /></div><div><p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>{avgMPG} MPG</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Avg efficiency</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(196, 120, 42, 0.1)" }}><Droplets size={20} style={{ color: "var(--accent-orange)" }} /></div><div><p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>{records.length}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Refuels</p></div></div>
      </div>

      <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by truck or driver..." className="glass-input w-full pl-10" /></div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Truck</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Gallons</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Cost</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>MPG</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Driver</th>
              <th className="text-right px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Actions</th>
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="text-center py-8"><div className="inline-block w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} /></td></tr>
              : filtered.length > 0 ? filtered.map((r) => (
                <tr key={r.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <td className="px-5 py-4"><span className="mono-font text-sm font-medium" style={{ color: "var(--accent-amber)" }}>{r.fleetId}</span><p className="text-xs" style={{ color: "var(--text-muted)" }}>{r.truckBrand} {r.truckModel}</p></td>
                  <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>{r.fuelDate}</td>
                  <td className="px-5 py-4 mono-font text-sm" style={{ color: "var(--text-primary)" }}>{Number(r.liters).toFixed(1)} gal</td>
                  <td className="px-5 py-4 mono-font text-sm" style={{ color: "var(--text-primary)" }}>{r.totalCost ? `$${Number(r.totalCost).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}</td>
                  <td className="px-5 py-4"><span className="mono-font text-sm px-2 py-1 rounded-md" style={{ background: Number(r.efficiency) > 0 ? "rgba(74, 155, 106, 0.15)" : "rgba(255,255,255,0.06)", color: Number(r.efficiency) > 0 ? "var(--accent-green)" : "var(--text-muted)" }}>{r.efficiency ? `${Number(r.efficiency).toFixed(1)} MPG` : "-"}</span></td>
                  <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>{r.driverName || "-"}</td>
                  <td className="px-5 py-4"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleEdit(r)} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-amber)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(r.id)} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-red)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}><Trash2 size={16} /></button>
                  </div></td>
                </tr>
              )) : <tr><td colSpan={7} className="text-center py-12" style={{ color: "var(--text-muted)" }}><Droplets size={48} className="mx-auto mb-3 opacity-30" /><p>No records found</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: "var(--bg-panel-solid)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{editingId ? "Edit Refuel" : "New Refuel"}</h2><button onClick={() => setModalOpen(false)} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Truck *</label>
                <select value={form.truckId} onChange={(e) => setForm({ ...form, truckId: e.target.value })} className="glass-input w-full" style={{ color: "var(--text-primary)" }} required>
                  <option value="">Select...</option>
                  {trucks.map((t) => <option key={t.id} value={t.id}>{t.fleetId} - {t.brand} {t.model} ({Number(t.currentKm).toLocaleString("en-US")} mi)</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Date *</label><input type="date" value={form.fuelDate} onChange={(e) => setForm({ ...form, fuelDate: e.target.value })} className="glass-input w-full" required /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Driver</label><input value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} className="glass-input w-full" placeholder="Driver name" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Gallons *</label><input type="number" step="0.01" value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} className="glass-input w-full mono-font" placeholder="84.5" required /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Price/Gal ($)</label><input type="number" step="0.01" value={form.pricePerLiter} onChange={(e) => setForm({ ...form, pricePerLiter: e.target.value })} className="glass-input w-full mono-font" placeholder="3.89" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Total Cost ($)</label><input type="number" step="0.01" value={form.totalCost} onChange={(e) => setForm({ ...form, totalCost: e.target.value })} className="glass-input w-full mono-font" placeholder="328.75" /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Station</label><input value={form.stationName} onChange={(e) => setForm({ ...form, stationName: e.target.value })} className="glass-input w-full" placeholder="Station name" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Odometer (miles)</label><input type="number" step="0.1" value={form.kmAtRefuel} onChange={(e) => setForm({ ...form, kmAtRefuel: e.target.value })} className="glass-input w-full mono-font" placeholder="77670" /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Previous Odometer</label><input type="number" step="0.1" value={form.kmPrevious} onChange={(e) => setForm({ ...form, kmPrevious: e.target.value })} className="glass-input w-full mono-font" placeholder="77170" /></div>
              </div>
              <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="glass-input w-full" rows={2} placeholder="Notes..." /></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button><button type="submit" className="btn-primary">{editingId ? "Update" : "Save"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
