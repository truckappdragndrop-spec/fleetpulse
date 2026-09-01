import { useState, useEffect } from "react";
import { useCollection } from "@/hooks/useCollection";
import { Plus, Search, Pencil, Trash2, X, Droplets, TrendingUp, Route, ArrowUpDown, ArrowUp, ArrowDown, Camera, Image, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDialogs } from "@/components/Dialogs";
import { checkOdometer } from "@/lib/truckSync";

interface FuelDoc {
  id: string; truckId: string; fleetId: string; truckBrand: string; truckModel: string;
  driverName?: string; fuelDate: string; liters: string; pricePerLiter?: string;
  totalCost?: string; kmAtRefuel?: string; kmPrevious?: string; kmDriven?: string;
  efficiency?: string; stationName?: string; notes?: string;
  /** Registros antigos têm uma foto só; os novos trazem a lista. */
  photoUrl?: string;
  photoUrls?: string[];
  createdAt: Timestamp;
}

/**
 * As fotos de um abastecimento, venha o registro de antes ou de depois de o
 * motorista poder mandar mais de uma. Sem isso, um registro antigo com foto
 * apareceria sem nenhuma.
 */
function recordPhotos(r: { photoUrls?: string[]; photoUrl?: string }): string[] {
  if (r.photoUrls && r.photoUrls.length > 0) return r.photoUrls;
  return r.photoUrl ? [r.photoUrl] : [];
}

interface TruckDoc { id: string; fleetId: string; brand: string; model: string; currentKm: string; createdAt: Timestamp; }

type SortField = "fuelDate" | "totalCost" | "kmAtRefuel" | null;
type SortDir = "asc" | "desc";

export default function Fuel() {
  const { data: records, isLoading, create, update, remove } = useCollection<FuelDoc>("fuelRecords");
  const { confirm, notify } = useDialogs();
  const { data: trucks } = useCollection<TruckDoc>("trucks");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ truckId: "", driverName: "", fuelDate: new Date().toISOString().split("T")[0], liters: "", pricePerLiter: "", totalCost: "", kmAtRefuel: "", kmPrevious: "", stationName: "", notes: "" });
  const [autoCost, setAutoCost] = useState("");
  const [sortField, setSortField] = useState<SortField>("fuelDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [photoView, setPhotoView] = useState<{ urls: string[]; index: number } | null>(null);

  // Filtro de período, igual ao de Checklists e Relatórios.
  const [period, setPeriod] = useState<"all" | "day" | "month" | "year">("all");
  const [dayValue, setDayValue] = useState("");
  const [monthValue, setMonthValue] = useState("");
  const [yearValue, setYearValue] = useState("");

  const resetForm = () => {
    setForm({ truckId: "", driverName: "", fuelDate: new Date().toISOString().split("T")[0], liters: "", pricePerLiter: "", totalCost: "", kmAtRefuel: "", kmPrevious: "", stationName: "", notes: "" });
    setAutoCost("");
  };

  useEffect(() => {
    const gal = Number(form.liters) || 0;
    const price = Number(form.pricePerLiter) || 0;
    if (gal > 0 && price > 0) {
      const calculated = (gal * price).toFixed(2);
      setAutoCost(calculated);
      setForm(prev => ({ ...prev, totalCost: calculated }));
    } else {
      setAutoCost("");
    }
  }, [form.liters, form.pricePerLiter]);

  useEffect(() => {
    if (form.truckId && !editingId) {
      const truck = trucks.find((t) => t.id === form.truckId);
      if (truck) {
        setForm(prev => ({ ...prev, kmPrevious: truck.currentKm }));
      }
    }
  }, [form.truckId, trucks, editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.truckId || !form.liters || !form.fuelDate) return;
    const gal = Number(form.liters);
    const price = Number(form.pricePerLiter) || 0;
    const autoTotalCost = price > 0 ? (gal * price).toFixed(2) : (form.totalCost || "");
    const miAt = form.kmAtRefuel ? Number(form.kmAtRefuel) : 0;
    const miPrev = form.kmPrevious ? Number(form.kmPrevious) : 0;
    const miDriven = miAt - miPrev;
    const validMiDriven = miDriven > 0 ? miDriven : 0;
    const rawMpg = validMiDriven > 0 ? (validMiDriven / gal) : 0;
    const mpg = rawMpg > 0 && rawMpg < 50 ? rawMpg.toFixed(1) : "0";
    const truck = trucks.find((t) => t.id === form.truckId);

    // Milhagem menor que a atual do caminhão é quase sempre erro de digitação
    // (um dígito a menos). Gravar sem perguntar contamina MPG, alerta de óleo
    // e relatórios, e o estrago passa despercebido.
    const odo = checkOdometer(miAt, truck?.currentKm);
    if (!odo.ok) {
      const proceed = await confirm({
        title: "Odometer lower than the truck's current mileage",
        message: `O caminhão está com ${odo.current.toLocaleString()} mi e você digitou ${miAt.toLocaleString()} mi. Conferir antes de gravar?`,
        confirmLabel: "Save anyway",
        cancelLabel: "Let me fix it",
      });
      if (!proceed) return;
    }

    const payload = { 
      ...form, 
      totalCost: autoTotalCost,
      fleetId: truck?.fleetId || "", 
      truckBrand: truck?.brand || "", 
      truckModel: truck?.model || "", 
      kmDriven: validMiDriven > 0 ? String(validMiDriven) : "", 
      efficiency: mpg 
    };
    if (editingId) { 
      await update(editingId, payload); 
    } else { 
      await create(payload); 
    }
    if (form.kmAtRefuel && truck) {
      try {
        const truckRef = doc(db, "trucks", form.truckId);
        await updateDoc(truckRef, { currentKm: form.kmAtRefuel });
      } catch (err) {
        console.error("Error updating truck mileage:", err);
        notify("Record saved, but the truck mileage was not updated", "warning");
      }
    }
    setModalOpen(false); 
    setEditingId(null); 
    resetForm();
  };

  const handleEdit = (r: FuelDoc) => { 
    setEditingId(r.id); 
    setForm({ 
      truckId: r.truckId, 
      driverName: r.driverName || "", 
      fuelDate: r.fuelDate, 
      liters: String(r.liters), 
      pricePerLiter: r.pricePerLiter || "", 
      totalCost: r.totalCost || "", 
      kmAtRefuel: r.kmAtRefuel || "", 
      kmPrevious: r.kmPrevious || "", 
      stationName: r.stationName || "", 
      notes: r.notes || "" 
    }); 
    setAutoCost(r.totalCost || "");
    setModalOpen(true); 
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this fuel record?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) await remove(id);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={14} style={{ color: "var(--text-muted)", opacity: 0.5 }} />;
    return sortDir === "asc" ? <ArrowUp size={14} style={{ color: "var(--accent-amber)" }} /> : <ArrowDown size={14} style={{ color: "var(--accent-amber)" }} />;
  };

  // fuelDate é gravado como "AAAA-MM-DD", então comparar os primeiros
  // caracteres já resolve dia, mês e ano — sem precisar converter para Date.
  const inPeriod = (value?: string) => {
    if (period === "all") return true;
    const ymd = (value || "").slice(0, 10);
    if (!ymd) return false;
    if (period === "day") return dayValue ? ymd === dayValue : true;
    if (period === "month") return monthValue ? ymd.slice(0, 7) === monthValue : true;
    return yearValue ? ymd.slice(0, 4) === yearValue : true;
  };

  const availableYears = Array.from(
    new Set(records.map(r => (r.fuelDate || "").slice(0, 4)).filter(Boolean))
  ).sort().reverse();

  const periodLabel =
    period === "all" ? "All time / Todo o período"
    : period === "day" ? (dayValue ? new Date(dayValue + "T00:00:00").toLocaleDateString("en-US", { dateStyle: "long" }) : "Pick a day")
    : period === "month" ? (monthValue ? new Date(monthValue + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "Pick a month")
    : (yearValue || "Pick a year");

  const filtered = records.filter((r) => {
    const term = search.trim().toLowerCase();
    const matchesText =
      !term ||
      r.fleetId?.toLowerCase().includes(term) ||
      r.driverName?.toLowerCase().includes(term) ||
      r.truckBrand?.toLowerCase().includes(term) ||
      r.truckModel?.toLowerCase().includes(term) ||
      r.stationName?.toLowerCase().includes(term);
    return matchesText && inPeriod(r.fuelDate);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    let valA: any, valB: any;
    if (sortField === "fuelDate") {
      valA = a.fuelDate || "";
      valB = b.fuelDate || "";
    } else if (sortField === "totalCost") {
      valA = Number(a.totalCost) || 0;
      valB = Number(b.totalCost) || 0;
    } else if (sortField === "kmAtRefuel") {
      valA = Number(a.kmAtRefuel) || 0;
      valB = Number(b.kmAtRefuel) || 0;
    }
    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // Os números do topo refletem exatamente o que está na lista — período e
  // busca incluídos. Total "de sempre" ao lado de uma lista filtrada mentiria.
  const totalGal = filtered.reduce((s, r) => s + Number(r.liters), 0);
  const totalCost = filtered.reduce((s, r) => s + Number(r.totalCost || 0), 0);
  const avgMPG = filtered.length > 0 ? (filtered.reduce((s, r) => s + (Number(r.efficiency) || 0), 0) / filtered.length).toFixed(1) : "0.0";
  const totalKmDriven = filtered.reduce((s, r) => s + Number(r.kmDriven || 0), 0);
  const avgKmPerRefuel = filtered.length > 0 ? (totalKmDriven / filtered.length).toFixed(0) : "0";

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
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(196, 120, 42, 0.1)" }}><Droplets size={20} style={{ color: "var(--accent-orange)" }} /></div><div><p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>{filtered.length}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Refuels</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(139, 92, 246, 0.1)" }}><Route size={20} style={{ color: "#8b5cf6" }} /></div><div><p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>{totalKmDriven.toLocaleString("en-US")} mi</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Total miles</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(59, 130, 246, 0.1)" }}><TrendingUp size={20} style={{ color: "#3b82f6" }} /></div><div><p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>{avgKmPerRefuel} mi</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Avg per refuel</p></div></div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by truck, driver or station..." className="glass-input w-full pl-10" />
        </div>

        {/* Período */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: "var(--text-muted)" }}>
            <Calendar size={14} /> Date / Data
          </span>

          {([
            { key: "all", label: "All / Tudo" },
            { key: "day", label: "Day / Dia" },
            { key: "month", label: "Month / Mês" },
            { key: "year", label: "Year / Ano" },
          ] as { key: typeof period; label: string }[]).map(opt => (
            <button
              key={opt.key}
              onClick={() => {
                setPeriod(opt.key);
                const today = new Date().toISOString().split("T")[0];
                if (opt.key === "day" && !dayValue) setDayValue(today);
                if (opt.key === "month" && !monthValue) setMonthValue(today.slice(0, 7));
                if (opt.key === "year" && !yearValue) setYearValue(availableYears[0] || today.slice(0, 4));
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: period === opt.key ? "var(--accent-amber)" : "var(--bg-secondary)",
                color: period === opt.key ? "#1a1a1a" : "var(--text-secondary)",
                border: "1px solid var(--border-divider)",
              }}
            >
              {opt.label}
            </button>
          ))}

          {period === "day" && (
            <input type="date" value={dayValue} onChange={(e) => setDayValue(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)", colorScheme: "dark" }} />
          )}
          {period === "month" && (
            <input type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)", colorScheme: "dark" }} />
          )}
          {period === "year" && (
            <select value={yearValue} onChange={(e) => setYearValue(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}>
              {availableYears.length === 0 && <option value={yearValue}>{yearValue}</option>}
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}

          <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
            Showing <span style={{ color: "var(--accent-amber)" }}>{periodLabel}</span>
            {" • "}{filtered.length} refuel{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Truck</th>
              <th className="text-left px-5 py-3 text-sm font-medium cursor-pointer select-none" style={{ color: "var(--text-muted)" }} onClick={() => handleSort("fuelDate")}>
                <div className="flex items-center gap-1">Date {getSortIcon("fuelDate")}</div>
              </th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Gallons</th>
              <th className="text-left px-5 py-3 text-sm font-medium cursor-pointer select-none" style={{ color: "var(--text-muted)" }} onClick={() => handleSort("totalCost")}>
                <div className="flex items-center gap-1">Cost {getSortIcon("totalCost")}</div>
              </th>
              <th className="text-left px-5 py-3 text-sm font-medium cursor-pointer select-none" style={{ color: "var(--text-muted)" }} onClick={() => handleSort("kmAtRefuel")}>
                <div className="flex items-center gap-1">Odometer {getSortIcon("kmAtRefuel")}</div>
              </th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Miles</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>MPG</th>
              <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Driver</th>
              <th className="text-center px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Photo</th>
              <th className="text-right px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Actions</th>
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={10} className="text-center py-8"><div className="inline-block w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} /></td></tr>
              : sorted.length > 0 ? sorted.map((r) => (
                <tr key={r.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <td className="px-5 py-4"><span className="mono-font text-sm font-medium" style={{ color: "var(--accent-amber)" }}>{r.fleetId}</span><p className="text-xs" style={{ color: "var(--text-muted)" }}>{r.truckBrand} {r.truckModel}</p></td>
                  <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>{r.fuelDate}</td>
                  <td className="px-5 py-4 mono-font text-sm" style={{ color: "var(--text-primary)" }}>{Number(r.liters).toFixed(1)} gal</td>
                  <td className="px-5 py-4 mono-font text-sm" style={{ color: "var(--text-primary)" }}>{r.totalCost ? `$${Number(r.totalCost).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}</td>
                  <td className="px-5 py-4 mono-font text-sm" style={{ color: "var(--text-primary)" }}>{r.kmAtRefuel ? `${Number(r.kmAtRefuel).toLocaleString("en-US")} mi` : "-"}</td>
                  <td className="px-5 py-4 mono-font text-sm" style={{ color: "var(--text-primary)" }}>{r.kmDriven ? `${Number(r.kmDriven).toLocaleString("en-US")} mi` : "-"}</td>
                  <td className="px-5 py-4"><span className="mono-font text-sm px-2 py-1 rounded-md" style={{ background: Number(r.efficiency) > 0 ? "rgba(74, 155, 106, 0.15)" : "rgba(255,255,255,0.06)", color: Number(r.efficiency) > 0 ? "var(--accent-green)" : "var(--text-muted)" }}>{r.efficiency ? `${Number(r.efficiency).toFixed(1)} MPG` : "-"}</span></td>
                  <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>{r.driverName || "-"}</td>
                  <td className="px-5 py-4 text-center">
                    {(() => {
                      const photos = recordPhotos(r);
                      if (photos.length === 0) {
                        return (
                          <span className="inline-flex items-center justify-center w-8 h-8" style={{ color: "var(--text-muted)", opacity: 0.3 }}>
                            <Image size={16} />
                          </span>
                        );
                      }
                      return (
                        <button
                          onClick={() => setPhotoView({ urls: photos, index: 0 })}
                          className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors"
                          style={{ color: "var(--accent-amber)" }}
                          title={photos.length > 1 ? `${photos.length} photos / ${photos.length} fotos` : "View photo / Ver foto"}
                        >
                          <Camera size={16} />
                          {photos.length > 1 && (
                            <span
                              className="absolute -top-0.5 -right-0.5 flex items-center justify-center mono-font font-bold rounded-full"
                              style={{ width: 14, height: 14, fontSize: 9, background: "var(--accent-amber)", color: "#1a1a1a" }}
                            >
                              {photos.length}
                            </span>
                          )}
                        </button>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-4"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleEdit(r)} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-amber)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(r.id)} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-red)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}><Trash2 size={16} /></button>
                  </div></td>
                </tr>
              )) : <tr><td colSpan={10} className="text-center py-12" style={{ color: "var(--text-muted)" }}><Droplets size={48} className="mx-auto mb-3 opacity-30" /><p>No records found</p></td></tr>}
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
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Total Cost ($) {autoCost && <span style={{color: "var(--accent-green)", fontSize: 12}}>(Auto: ${autoCost})</span>}</label><input type="number" step="0.01" value={form.totalCost} onChange={(e) => setForm({ ...form, totalCost: e.target.value })} className="glass-input w-full mono-font" placeholder={autoCost || "328.75"} /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Station</label><input value={form.stationName} onChange={(e) => setForm({ ...form, stationName: e.target.value })} className="glass-input w-full" placeholder="Station name" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Odometer (miles)</label><input type="number" step="0.1" value={form.kmAtRefuel} onChange={(e) => setForm({ ...form, kmAtRefuel: e.target.value })} className="glass-input w-full mono-font" placeholder="77670" /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Previous Odometer {form.kmPrevious && <span style={{color: "var(--text-muted)", fontSize: 12}}>(Current: {form.kmPrevious} mi)</span>}</label><input type="number" step="0.1" value={form.kmPrevious} onChange={(e) => setForm({ ...form, kmPrevious: e.target.value })} className="glass-input w-full mono-font" placeholder="77170" /></div>
              </div>
              <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="glass-input w-full" rows={2} placeholder="Notes..." /></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button><button type="submit" className="btn-primary">{editingId ? "Update" : "Save"}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Viewer */}
      {photoView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setPhotoView(null)}
        >
          {/* O clique nos controles não pode fechar o visualizador junto. */}
          <div className="relative flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {photoView.urls.length > 1 && (
              <button
                onClick={() => setPhotoView((v) => (v ? { ...v, index: (v.index - 1 + v.urls.length) % v.urls.length } : v))}
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 40, height: 40, background: "rgba(255,255,255,0.12)", color: "#fff" }}
                aria-label="Previous / Anterior"
              >
                <ChevronLeft size={22} />
              </button>
            )}

            <div className="text-center">
              <img
                src={photoView.urls[photoView.index]}
                alt={`Fuel receipt ${photoView.index + 1}`}
                style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 8 }}
              />
              {photoView.urls.length > 1 && (
                <p className="mono-font text-sm mt-2" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {photoView.index + 1} / {photoView.urls.length}
                </p>
              )}
            </div>

            {photoView.urls.length > 1 && (
              <button
                onClick={() => setPhotoView((v) => (v ? { ...v, index: (v.index + 1) % v.urls.length } : v))}
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 40, height: 40, background: "rgba(255,255,255,0.12)", color: "#fff" }}
                aria-label="Next / Próxima"
              >
                <ChevronRight size={22} />
              </button>
            )}
          </div>

          <button
            onClick={() => setPhotoView(null)}
            className="absolute top-4 right-4 flex items-center justify-center rounded-full"
            style={{ width: 36, height: 36, background: "rgba(255,255,255,0.12)", color: "#fff" }}
            aria-label="Close / Fechar"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
