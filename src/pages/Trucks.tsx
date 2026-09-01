import { useState, useRef } from "react";
import { useCollection } from "@/hooks/useCollection";
import { Link } from "react-router";
import {
  Truck, Search, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Eye, Camera,
  ChevronDown, Check, Wrench,
} from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import { uploadImage, imageSrc } from "@/lib/uploadImage";
import { useDialogs } from "@/components/Dialogs";
import { PM_SERVICES, truckRules, type PmRules } from "@/lib/preventive";

interface TruckDoc {
  id: string;
  fleetId: string;
  plate: string;
  vin?: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  currentKm: string;
  fuelTankCapacity?: number;
  status: "active" | "maintenance" | "inactive" | "sold";
  notes?: string;
  imageUrl?: string;
  /** Registros antigos: foto em base64 dentro do próprio documento. */
  imageBase64?: string;
  registrationExpiry?: string;
  insuranceExpiry?: string;
  inspectionExpiry?: string;
  lastOilChangeMiles?: string;
  oilChangeInterval?: string;
  /** Intervalos de manutenção preventiva deste caminhão. */
  pmRules?: PmRules;
  createdAt: Timestamp;
}

const emptyForm = {
  fleetId: "", plate: "", vin: "", brand: "", model: "", year: new Date().getFullYear(),
  color: "", currentKm: "0", fuelTankCapacity: 0, status: "active" as const, notes: "", imageUrl: "",
  registrationExpiry: "", insuranceExpiry: "", inspectionExpiry: "", lastOilChangeMiles: "", oilChangeInterval: "10000",
  pmRules: {} as PmRules,
};

export default function Trucks() {
  const { data: trucks, isLoading, create, update, remove } = useCollection<TruckDoc>("trucks");
  const { confirm, notify } = useDialogs();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  // Só apaga o base64 antigo quando a foto foi de fato trocada nesta edição.
  const [photoReplaced, setPhotoReplaced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageSize = 10;
  const [pmOpen, setPmOpen] = useState(false);

  // O editor mostra sempre um conjunto completo de regras: o padrão do
  // catálogo, sobrescrito pelo que este caminhão já tem salvo. Assim ninguém
  // precisa preencher oito linhas do zero para o alerta começar a funcionar.
  const rules = truckRules(form);
  const setRule = (key: string, patch: Partial<PmRules[string]>) =>
    setForm((prev) => {
      const base = truckRules(prev);
      return { ...prev, pmRules: { ...base, [key]: { ...base[key], ...patch } } };
    });

  const filtered = trucks.filter((t) => {
    const matchSearch = !search || t.fleetId.toLowerCase().includes(search.toLowerCase()) || t.plate.toLowerCase().includes(search.toLowerCase()) || t.brand.toLowerCase().includes(search.toLowerCase()) || t.model.toLowerCase().includes(search.toLowerCase()) || (t.vin && t.vin.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Please select an image file", "warning");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("Image must be less than 5MB", "warning");
      return;
    }
    setUploadingImage(true);
    try {
      const url = await uploadImage(file, "trucks");
      setImagePreview(url);
      setForm(prev => ({ ...prev, imageUrl: url }));
      setPhotoReplaced(true);
    } catch (err) {
      notify("Failed to upload image", "error");
      console.error(err);
    } finally {
      setUploadingImage(false);
    }
  }

  function clearImage() {
    setImagePreview(null);
    setForm(prev => ({ ...prev, imageUrl: "" }));
    setPhotoReplaced(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fleetId || !form.plate || !form.brand || !form.model) return;
    // Grava o conjunto inteiro de regras, e não só o que foi mexido: o padrão
    // do catálogo pode mudar numa versão futura e não é para isso alterar em
    // silêncio o intervalo de um caminhão que já estava configurado.
    const savedRules = truckRules(form);
    const payload = {
      ...form,
      year: Number(form.year),
      fuelTankCapacity: Number(form.fuelTankCapacity) || 0,
      pmRules: savedRules,
      // O card antigo de óleo do Dashboard lê este campo — mantido em sincronia
      // com a regra, para as duas telas nunca discordarem.
      oilChangeInterval: String(savedRules.oil?.miles || 0),
      // Troca de foto: descarta o base64 antigo, que só ocupava espaço no doc.
      ...(photoReplaced ? { imageBase64: "" } : {}),
    };
    if (editingId) { await update(editingId, payload); }
    else { await create(payload); }
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setImagePreview(null);
    setPhotoReplaced(false);
  };

  const handleDelete = async (truck: TruckDoc) => {
    const ok = await confirm({
      title: "Delete truck?",
      message: `${truck.fleetId} — ${truck.brand} ${truck.model}. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) await remove(truck.id);
  };

  const openEdit = (truck: TruckDoc) => {
    setEditingId(truck.id);
    setForm({ fleetId: truck.fleetId, plate: truck.plate, vin: truck.vin || "", brand: truck.brand, model: truck.model, year: truck.year, color: truck.color || "", currentKm: truck.currentKm, fuelTankCapacity: truck.fuelTankCapacity || 0, status: truck.status, notes: truck.notes || "", imageUrl: truck.imageUrl || "", registrationExpiry: truck.registrationExpiry || "", insuranceExpiry: truck.insuranceExpiry || "", inspectionExpiry: truck.inspectionExpiry || "", lastOilChangeMiles: truck.lastOilChangeMiles || "", oilChangeInterval: truck.oilChangeInterval || "10000", pmRules: truck.pmRules || {} });
    setImagePreview(imageSrc(truck.imageUrl, truck.imageBase64) || null);
    setPhotoReplaced(false);
    setPmOpen(false);
    setModalOpen(true);
  };

  const getStatusColor = (s: string) => ({ active: "var(--accent-green)", maintenance: "var(--accent-orange)", inactive: "var(--text-muted)", sold: "var(--text-secondary)" }[s] || "var(--text-muted)");
  const getStatusLabel = (s: string) => ({ active: "Active", maintenance: "Maintenance", inactive: "Inactive", sold: "Sold" }[s] || s);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Fleet</h1><p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Manage your trucks</p></div>
        <button onClick={() => { setEditingId(null); setForm(emptyForm); setImagePreview(null); setPhotoReplaced(false); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> New Truck</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search by ID, plate, VIN, brand or model..." className="glass-input w-full pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className="glass-input" style={{ color: "var(--text-primary)", minWidth: 160 }}>
          <option value="">All statuses</option><option value="active">Active</option><option value="maintenance">In Maintenance</option><option value="inactive">Inactive</option><option value="sold">Sold</option>
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Photo</th>
                <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>ID</th>
                <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Plate</th>
                <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>VIN/Chassis</th>
                <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Brand/Model</th>
                <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Year</th>
                <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Miles</th>
                <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
                <th className="text-right px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-8"><div className="inline-block w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} /></td></tr>
              ) : paginated.length > 0 ? (
                paginated.map((truck) => (
                  <tr key={truck.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                    <td className="px-5 py-4">
                      {imageSrc(truck.imageUrl, truck.imageBase64) ? (
                        <img src={imageSrc(truck.imageUrl, truck.imageBase64)} alt={truck.fleetId} className="w-12 h-12 rounded-lg object-cover" style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                      ) : (
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <Truck size={20} style={{ color: "var(--text-muted)" }} />
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4"><span className="mono-font text-sm font-medium" style={{ color: "var(--accent-amber)" }}>{truck.fleetId}</span></td>
                    <td className="px-5 py-4"><span className="mono-font text-sm" style={{ color: "var(--text-primary)" }}>{truck.plate}</span></td>
                    <td className="px-5 py-4"><span className="mono-font text-xs" style={{ color: "var(--text-muted)" }}>{truck.vin || "N/A"}</span></td>
                    <td className="px-5 py-4"><p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{truck.brand}</p><p className="text-xs" style={{ color: "var(--text-muted)" }}>{truck.model}</p></td>
                    <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>{truck.year}</td>
                    <td className="px-5 py-4"><span className="mono-font text-sm" style={{ color: "var(--text-secondary)" }}>{Number(truck.currentKm).toLocaleString("en-US")} mi</span></td>
                    <td className="px-5 py-4"><span className="text-xs px-2 py-1 rounded-md" style={{ background: `${getStatusColor(truck.status)}15`, color: getStatusColor(truck.status) }}>{getStatusLabel(truck.status)}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/trucks/${truck.id}`} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ color: "var(--accent-amber)" }} title="View Details">
                          <Eye size={16} />
                        </Link>
                        <button onClick={() => openEdit(truck)} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-amber)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}><Pencil size={16} /></button>
                        <button onClick={() => handleDelete(truck)} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-red)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={9} className="text-center py-12" style={{ color: "var(--text-muted)" }}><Truck size={48} className="mx-auto mb-3 opacity-30" /><p>No trucks found</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border-divider)" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{filtered.length} trucks</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="p-2 rounded-lg disabled:opacity-30" style={{ color: "var(--text-secondary)" }}><ChevronLeft size={18} /></button>
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="p-2 rounded-lg disabled:opacity-30" style={{ color: "var(--text-secondary)" }}><ChevronRight size={18} /></button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: "var(--bg-panel-solid)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{editingId ? "Edit Truck" : "New Truck"}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Photo Upload */}
              <div>
                <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>Truck Photo</label>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-32 h-24 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden"
                    style={{ 
                      background: imagePreview ? "transparent" : "rgba(255,255,255,0.05)", 
                      border: "2px dashed rgba(255,255,255,0.2)",
                      borderColor: imagePreview ? "rgba(232,168,56,0.5)" : "rgba(255,255,255,0.2)"
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={24} style={{ color: "var(--text-muted)" }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg text-sm font-medium mb-2"
                      style={{ background: "rgba(232,168,56,0.15)", color: "#e8a838", border: "1px solid rgba(232,168,56,0.3)" }}
                    >
                      {imagePreview ? "Change Photo" : "Upload Photo"}
                    </button>
                    {imagePreview && (
                      <button 
                        type="button"
                        onClick={clearImage}
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "#ef4444" }}
                      >
                        <X size={12} /> Remove
                      </button>
                    )}
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Auto-compressed • Max 800KB</p>
                    {uploadingImage && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#e8a838", borderTopColor: "transparent" }} />
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Processing...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Fleet ID *</label><input value={form.fleetId} onChange={(e) => setForm({ ...form, fleetId: e.target.value })} className="glass-input w-full" placeholder="TRK-001" required /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>License Plate *</label><input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} className="glass-input w-full" placeholder="ABC-1234" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Brand *</label><input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="glass-input w-full" placeholder="Scania" required /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Model *</label><input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="glass-input w-full" placeholder="R450" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Year *</label><input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className="glass-input w-full" placeholder="2023" required /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Color</label><input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="glass-input w-full" placeholder="White" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Current Miles</label><input value={form.currentKm} onChange={(e) => setForm({ ...form, currentKm: e.target.value })} className="glass-input w-full mono-font" placeholder="0" /></div>
                <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Tank Capacity (gal)</label><input type="number" value={form.fuelTankCapacity} onChange={(e) => setForm({ ...form, fuelTankCapacity: Number(e.target.value) })} className="glass-input w-full" placeholder="132" /></div>
              </div>
              {/* Documents / Documentos */}
              <div style={{ borderTop: "1px solid var(--border-divider)", paddingTop: 12 }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--accent-amber)" }}>Documents / Documentos</p>
                <div className="space-y-3">
                  <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Registration Expiry / Venc. Registration</label><input type="date" value={form.registrationExpiry} onChange={(e) => setForm({ ...form, registrationExpiry: e.target.value })} className="glass-input w-full" style={{ color: "var(--text-primary)", colorScheme: "dark" }} /></div>
                  <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Insurance Expiry / Venc. Seguro</label><input type="date" value={form.insuranceExpiry} onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })} className="glass-input w-full" style={{ color: "var(--text-primary)", colorScheme: "dark" }} /></div>
                  <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>DOT Inspection Expiry / Venc. Inspecao DOT</label><input type="date" value={form.inspectionExpiry} onChange={(e) => setForm({ ...form, inspectionExpiry: e.target.value })} className="glass-input w-full" style={{ color: "var(--text-primary)", colorScheme: "dark" }} /></div>
                </div>
              </div>
              {/* Oil Change / Troca de Oleo */}
              <div style={{ borderTop: "1px solid var(--border-divider)", paddingTop: 12 }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--accent-amber)" }}>Oil Change / Troca de Oleo</p>
                <div>
                  <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Last Oil Change (miles) / Ultima troca</label>
                  <input type="number" value={form.lastOilChangeMiles} onChange={(e) => setForm({ ...form, lastOilChangeMiles: e.target.value })} className="glass-input w-full mono-font" placeholder="440000" />
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Only needed once — after that, completing an oil-change work order updates it. / So precisa a primeira vez: depois disso a ordem de servico concluida atualiza sozinha.
                  </p>
                </div>
              </div>

              {/* Preventive Maintenance / Manutencao Preventiva */}
              <div style={{ borderTop: "1px solid var(--border-divider)", paddingTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setPmOpen(!pmOpen)}
                  className="w-full flex items-center justify-between gap-2 mb-1"
                >
                  <span className="flex items-center gap-2">
                    <Wrench size={14} style={{ color: "var(--accent-amber)" }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent-amber)" }}>
                      Preventive Maintenance / Manutencao Preventiva
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    style={{ color: "var(--text-muted)", transform: pmOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}
                  />
                </button>
                <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
                  {PM_SERVICES.filter((s) => rules[s.key]?.enabled).length} services tracked — leave a field at 0 to ignore it. / {PM_SERVICES.filter((s) => rules[s.key]?.enabled).length} servicos controlados. Deixe 0 no campo que nao quiser controlar.
                </p>

                {pmOpen && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-2">
                      <span className="flex-1" />
                      <span className="text-[10px] uppercase tracking-wider text-right" style={{ color: "var(--text-muted)", width: 96 }}>Every (miles)</span>
                      <span className="text-[10px] uppercase tracking-wider text-right" style={{ color: "var(--text-muted)", width: 74 }}>Every (months)</span>
                    </div>
                    {PM_SERVICES.map((svc) => {
                      const rule = rules[svc.key];
                      return (
                        <div
                          key={svc.key}
                          className="flex items-center gap-2 p-2 rounded-lg"
                          style={{
                            background: rule.enabled ? "rgba(255,255,255,0.03)" : "transparent",
                            border: "1px solid var(--border-divider)",
                            opacity: rule.enabled ? 1 : 0.5,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setRule(svc.key, { enabled: !rule.enabled })}
                            className="flex items-center justify-center rounded flex-shrink-0"
                            style={{
                              width: 20, height: 20,
                              background: rule.enabled ? "var(--accent-amber)" : "transparent",
                              border: "1px solid " + (rule.enabled ? "var(--accent-amber)" : "var(--border-subtle)"),
                            }}
                            title={rule.enabled ? "Tracking / Controlando" : "Ignored / Ignorado"}
                          >
                            {rule.enabled && <Check size={13} style={{ color: "#1a1a1a" }} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{svc.label}</p>
                            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{svc.labelPt}</p>
                          </div>
                          <input
                            type="number"
                            min={0}
                            value={rule.miles || ""}
                            onChange={(e) => setRule(svc.key, { miles: Number(e.target.value) || 0 })}
                            disabled={!rule.enabled}
                            className="glass-input mono-font text-sm text-right"
                            style={{ width: 96, padding: "6px 8px" }}
                            placeholder="0"
                          />
                          <input
                            type="number"
                            min={0}
                            value={rule.months || ""}
                            onChange={(e) => setRule(svc.key, { months: Number(e.target.value) || 0 })}
                            disabled={!rule.enabled}
                            className="glass-input mono-font text-sm text-right"
                            style={{ width: 74, padding: "6px 8px" }}
                            placeholder="0"
                          />
                        </div>
                      );
                    })}
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Whichever comes first counts. The clock resets when a matching work order is completed. / Vale o que vencer primeiro. O relogio zera quando uma ordem de servico do mesmo tipo e concluida.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>VIN / Chassis</label>
                <input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} className="glass-input w-full mono-font" placeholder="1HGBH41JXMN109186" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "maintenance" | "inactive" | "sold" })} className="glass-input w-full" style={{ color: "var(--text-primary)" }}>
                  <option value="active">Active</option><option value="maintenance">In Maintenance</option><option value="inactive">Inactive</option><option value="sold">Sold</option>
                </select>
              </div>
              <div><label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="glass-input w-full" rows={3} placeholder="Additional notes..." /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary" disabled={uploadingImage}>{editingId ? "Update" : "Add Truck"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
