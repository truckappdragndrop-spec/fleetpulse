import { useState } from "react";
import { useCollection } from "@/hooks/useCollection";
import { Plus, Search, CheckCircle2, XCircle, ClipboardCheck, X, AlertTriangle } from "lucide-react";
import type { Timestamp } from "firebase/firestore";

const checklistItems = [
  { key: "tiresOk", label: "Tires" }, { key: "brakesOk", label: "Brakes" }, { key: "lightsOk", label: "Lights" },
  { key: "oilLevelOk", label: "Oil Level" }, { key: "coolantLevelOk", label: "Coolant" }, { key: "wipersOk", label: "Wipers" },
  { key: "hornOk", label: "Horn" }, { key: "mirrorsOk", label: "Mirrors" }, { key: "seatbeltOk", label: "Seatbelt" },
  { key: "fireExtinguisherOk", label: "Extinguisher" }, { key: "emergencyKitOk", label: "Emergency Kit" }, { key: "documentsOk", label: "Documents" },
] as const;

interface CheckDoc { id: string; truckId: string; fleetId: string; truckBrand: string; truckModel: string; driverName: string; checklistDate: string; shift: string; status: string; issuesFound: boolean; issuesDescription?: string; observations?: string; kmAtStart?: string; kmAtEnd?: string; tiresOk: boolean; brakesOk: boolean; lightsOk: boolean; oilLevelOk: boolean; coolantLevelOk: boolean; wipersOk: boolean; hornOk: boolean; mirrorsOk: boolean; seatbeltOk: boolean; fireExtinguisherOk: boolean; emergencyKitOk: boolean; documentsOk: boolean; createdAt: Timestamp; }
interface TruckDoc { id: string; fleetId: string; brand: string; model: string; status: string; createdAt: Timestamp; }

export default function Checklists() {
  const { data: records, isLoading, create } = useCollection<CheckDoc>("driverChecklists");
  const { data: allRecords } = useCollection<CheckDoc>("driverChecklists");
  const { data: trucks } = useCollection<TruckDoc>("trucks");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    truckId: "", driverName: "", shift: "morning", kmAtStart: "", kmAtEnd: "",
    tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true,
    wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true,
    emergencyKitOk: true, documentsOk: true, observations: "", issuesFound: false, issuesDescription: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.truckId || !form.driverName) return;
    const hasIssues = checklistItems.some((item) => !form[item.key as keyof typeof form]);
    const truck = trucks.find((t) => t.id === form.truckId);
    await create({
      truckId: form.truckId, fleetId: truck?.fleetId || "", truckBrand: truck?.brand || "", truckModel: truck?.model || "",
      driverName: form.driverName, checklistDate: today, shift: form.shift as "morning" | "afternoon" | "night",
      kmAtStart: form.kmAtStart || "", kmAtEnd: form.kmAtEnd || "", tiresOk: form.tiresOk, brakesOk: form.brakesOk,
      lightsOk: form.lightsOk, oilLevelOk: form.oilLevelOk, coolantLevelOk: form.coolantLevelOk, wipersOk: form.wipersOk,
      hornOk: form.hornOk, mirrorsOk: form.mirrorsOk, seatbeltOk: form.seatbeltOk, fireExtinguisherOk: form.fireExtinguisherOk,
      emergencyKitOk: form.emergencyKitOk, documentsOk: form.documentsOk, observations: form.observations || "",
      issuesFound: hasIssues || form.issuesFound, issuesDescription: form.issuesDescription || "",
      status: hasIssues || form.issuesFound ? "issues_reported" : "completed",
    });
    setModalOpen(false);
  };

  const todayRecords = records.filter((r) => r.checklistDate === today);
  const filtered = todayRecords.filter((r) => !search || r.fleetId?.toLowerCase().includes(search.toLowerCase()) || r.driverName?.toLowerCase().includes(search.toLowerCase()));
  const selected = allRecords.find((r) => r.id === detailModal);

  const completedToday = todayRecords.filter((c) => c.status === "completed").length;
  const issuesToday = todayRecords.filter((c) => c.status === "issues_reported").length;
  const totalTrucks = trucks.filter((t) => t.status === "active").length;
  const rate = totalTrucks > 0 ? Math.round((completedToday / totalTrucks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Daily Checklist</h1><p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Driver inspections - {new Date().toLocaleDateString("en-US")}</p></div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> New Checklist</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(74, 155, 106, 0.1)" }}><CheckCircle2 size={20} style={{ color: "var(--accent-green)" }} /></div><div><p className="text-lg font-semibold" style={{ color: "var(--accent-green)" }}>{completedToday}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Completed</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(184, 64, 64, 0.1)" }}><AlertTriangle size={20} style={{ color: "var(--accent-red)" }} /></div><div><p className="text-lg font-semibold" style={{ color: "var(--accent-red)" }}>{issuesToday}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>With Issues</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(232, 168, 56, 0.1)" }}><ClipboardCheck size={20} style={{ color: "var(--accent-amber)" }} /></div><div><p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{totalTrucks}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Fleet Total</p></div></div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Today's Progress: {completedToday}/{totalTrucks}</span>
          <span className="text-sm font-semibold mono-font" style={{ color: "var(--accent-amber)" }}>{rate}%</span>
        </div>
        <div className="w-full rounded-full h-3 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${rate}%`, background: "linear-gradient(90deg, var(--accent-amber), var(--accent-gold))" }} />
        </div>
      </div>

      <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by truck or driver..." className="glass-input w-full pl-10" /></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? <div className="col-span-full text-center py-8"><div className="inline-block w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} /></div>
        : filtered.length > 0 ? filtered.map((record) => (
          <div key={record.id} className="glass-card p-5 cursor-pointer" onClick={() => setDetailModal(record.id)}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: record.status === "completed" ? "rgba(74, 155, 106, 0.1)" : "rgba(184, 64, 64, 0.1)" }}>
                  {record.status === "completed" ? <CheckCircle2 size={22} style={{ color: "var(--accent-green)" }} /> : <AlertTriangle size={22} style={{ color: "var(--accent-red)" }} />}
                </div>
                <div>
                  <span className="mono-font text-sm font-medium" style={{ color: "var(--accent-amber)" }}>{record.fleetId}</span>
                  <p className="text-sm" style={{ color: "var(--text-primary)" }}>{record.driverName}</p>
                  <p style={{ color: "var(--text-muted)", fontSize: 12 }}>{record.truckBrand} {record.truckModel}</p>
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded-md flex-shrink-0" style={{ background: record.status === "completed" ? "rgba(74, 155, 106, 0.15)" : "rgba(184, 64, 64, 0.15)", color: record.status === "completed" ? "var(--accent-green)" : "var(--accent-red)" }}>{record.status === "completed" ? "Done" : "Issues"}</span>
            </div>
            {record.issuesFound && record.issuesDescription && <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: "rgba(184, 64, 64, 0.08)", color: "var(--accent-red)" }}>{record.issuesDescription}</div>}
            <div className="mt-3 grid grid-cols-6 gap-2">
              {checklistItems.slice(0, 6).map((item) => {
                const val = record[item.key as keyof typeof record] as boolean;
                return <div key={item.key} className="flex flex-col items-center gap-1"><div className="flex items-center justify-center rounded-full" style={{ width: 24, height: 24, background: val ? "rgba(74, 155, 106, 0.15)" : "rgba(184, 64, 64, 0.15)" }}>{val ? <CheckCircle2 size={14} style={{ color: "var(--accent-green)" }} /> : <XCircle size={14} style={{ color: "var(--accent-red)" }} />}</div><span style={{ color: "var(--text-muted)", fontSize: 9 }}>{item.label}</span></div>;
              })}
            </div>
          </div>
        )) : <div className="col-span-full text-center py-12" style={{ color: "var(--text-muted)" }}><ClipboardCheck size={48} className="mx-auto mb-3 opacity-30" /><p>No checklists today</p></div>}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: "var(--bg-panel-solid)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>New Checklist</h2><button onClick={() => setModalOpen(false)} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Truck *</label>
                <select value={form.truckId} onChange={(e) => setForm({ ...form, truckId: e.target.value })} className="glass-input w-full" style={{ color: "var(--text-primary)" }} required>
                  <option value="">Select...</option>
                  {trucks.filter((t) => t.status === "active").map((t) => <option key={t.id} value={t.id}>{t.fleetId} - {t.brand} {t.model}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Driver *</label><input value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} className="glass-input w-full" placeholder="Driver name" required /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Shift *</label>
                  <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className="glass-input w-full" style={{ color: "var(--text-primary)" }}><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="night">Night</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Start Miles</label><input value={form.kmAtStart} onChange={(e) => setForm({ ...form, kmAtStart: e.target.value })} className="glass-input w-full mono-font" placeholder="0" /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>End Miles</label><input value={form.kmAtEnd} onChange={(e) => setForm({ ...form, kmAtEnd: e.target.value })} className="glass-input w-full mono-font" placeholder="0" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Inspections</label>
                <div className="grid grid-cols-2 gap-3">
                  {checklistItems.map((item) => {
                    const val = form[item.key as keyof typeof form] as boolean;
                    return <label key={item.key} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ background: val ? "rgba(74, 155, 106, 0.08)" : "rgba(184, 64, 64, 0.08)", border: `1px solid ${val ? "rgba(74, 155, 106, 0.2)" : "rgba(184, 64, 64, 0.2)"}` }}>
                      <input type="checkbox" checked={val} onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })} className="w-4 h-4 accent-green-500" />
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{item.label}</span>
                    </label>;
                  })}
                </div></div>
              <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Notes</label><textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} className="glass-input w-full" rows={2} placeholder="General observations..." /></div>
              <div><label className="flex items-center gap-2 mb-2"><input type="checkbox" checked={form.issuesFound} onChange={(e) => setForm({ ...form, issuesFound: e.target.checked })} className="w-4 h-4" /><span className="text-sm" style={{ color: "var(--accent-red)" }}>Issues found</span></label>
                {form.issuesFound && <textarea value={form.issuesDescription} onChange={(e) => setForm({ ...form, issuesDescription: e.target.value })} className="glass-input w-full" rows={2} placeholder="Describe the issues found..." />}</div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button><button type="submit" className="btn-primary">Submit</button></div>
            </form>
          </div>
        </div>
      )}

      {detailModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setDetailModal(null)} />
          <div className="relative w-full max-w-md rounded-2xl p-6" style={{ background: "var(--bg-panel-solid)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Checklist Details</h2><button onClick={() => setDetailModal(null)} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={20} /></button></div>
            <div className="space-y-3">
              <div className="flex items-center gap-3"><span className="mono-font text-sm font-medium" style={{ color: "var(--accent-amber)" }}>{selected.fleetId}</span><span className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>{selected.shift === "morning" ? "Morning" : selected.shift === "afternoon" ? "Afternoon" : "Night"}</span></div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}><strong style={{ color: "var(--text-primary)" }}>Driver:</strong> {selected.driverName}</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}><strong style={{ color: "var(--text-primary)" }}>Date:</strong> {selected.checklistDate}</p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {checklistItems.map((item) => {
                  const val = selected[item.key as keyof typeof selected] as boolean;
                  return <div key={item.key} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>{val ? <CheckCircle2 size={14} style={{ color: "var(--accent-green)" }} /> : <XCircle size={14} style={{ color: "var(--accent-red)" }} />}<span className="text-sm" style={{ color: val ? "var(--accent-green)" : "var(--accent-red)" }}>{item.label}</span></div>;
                })}
              </div>
              {selected.issuesDescription && <div className="p-3 rounded-lg text-sm" style={{ background: "rgba(184, 64, 64, 0.1)", color: "var(--accent-red)" }}><strong>Issues:</strong> {selected.issuesDescription}</div>}
              {selected.observations && <p className="text-sm" style={{ color: "var(--text-secondary)" }}><strong style={{ color: "var(--text-primary)" }}>Notes:</strong> {selected.observations}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
