import { useState, useEffect, useRef } from "react";
import { useCollection } from "@/hooks/useCollection";
import { Plus, Search, Package, Wrench, Trash2, Edit3, History, Camera, X } from "lucide-react";

interface PartDoc {
  id: string;
  name: string;
  supplier: string;
  category: string;
  quantity: number;
  minStock: number;
  cost: number;
  partNumber?: string;
  notes?: string;
  imageBase64?: string;
  createdAt: string;
}

interface HistoryDoc {
  id: string;
  partId: string;
  partName: string;
  truck: string;
  quantity: number;
  totalCost: number;
  reason: string;
  date: string;
  createdAt: string;
}

interface TruckDoc {
  id: string;
  fleetId: string;
  brand: string;
  model: string;
  currentKm: string;
}

function compressImage(file: File, maxWidth: number = 400, maxSizeKB: number = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        let quality = 0.7;
        let base64 = canvas.toDataURL("image/jpeg", quality);
        while (base64.length > maxSizeKB * 1024 && quality > 0.1) {
          quality -= 0.1;
          base64 = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(base64);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Inventory() {
  const { data: parts, isLoading, create, update, remove } = useCollection<PartDoc>("parts");
  const { data: history, create: createHistory } = useCollection<HistoryDoc>("partsHistory");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [useModalOpen, setUseModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<PartDoc | null>(null);

  const [form, setForm] = useState({
    name: "", supplier: "", category: "engine", quantity: 0, minStock: 5, cost: 0, partNumber: "", notes: "", imageBase64: ""
  });

  const [useForm, setUseForm] = useState({
    truck: "", partId: "", quantity: 1, reason: "", date: new Date().toISOString().split("T")[0], notes: ""
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: trucks } = useCollection<TruckDoc>("trucks");

  useEffect(() => {
    if (editingPart) {
      setForm({
        name: editingPart.name, supplier: editingPart.supplier, category: editingPart.category,
        quantity: editingPart.quantity, minStock: editingPart.minStock, cost: editingPart.cost,
        partNumber: editingPart.partNumber || "", notes: editingPart.notes || "", imageBase64: editingPart.imageBase64 || ""
      });
      setImagePreview(editingPart.imageBase64 || null);
      setUploadError(null);
    }
  }, [editingPart]);

  const filteredParts = parts.filter(p => {
    const match = p.name.toLowerCase().includes(search.toLowerCase()) || 
                  p.supplier.toLowerCase().includes(search.toLowerCase());
    if (filter === "in-stock") return match && p.quantity > p.minStock;
    if (filter === "low") return match && p.quantity > 0 && p.quantity <= p.minStock;
    if (filter === "out") return match && p.quantity === 0;
    return match;
  });

  const totalValue = parts.reduce((sum, p) => sum + p.quantity * p.cost, 0);
  const lowStock = parts.filter(p => p.quantity > 0 && p.quantity <= p.minStock).length;

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be less than 5MB");
      return;
    }
    setUploadingImage(true);
    try {
      const base64 = await compressImage(file);
      setImagePreview(base64);
      setForm(prev => ({ ...prev, imageBase64: base64 }));
      setUploadError(null);
    } catch (err) {
      setUploadError("Failed to process image");
      console.error(err);
    } finally {
      setUploadingImage(false);
    }
  }

  function clearImage() {
    setImagePreview(null);
    setUploadError(null);
    setForm(prev => ({ ...prev, imageBase64: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function savePart() {
    if (!form.name.trim() || !form.supplier.trim()) {
      alert("Please fill in Part Name and Supplier");
      return;
    }
    const data = { ...form, createdAt: new Date().toISOString() };
    if (editingPart) {
      await update(editingPart.id, data);
      setEditingPart(null);
    } else {
      await create(data);
    }
    setModalOpen(false);
    resetForm();
  }

  function resetForm() {
    setForm({ name: "", supplier: "", category: "engine", quantity: 0, minStock: 5, cost: 0, partNumber: "", notes: "", imageBase64: "" });
    setImagePreview(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function usePart() {
    if (!useForm.truck || !useForm.partId || useForm.quantity < 1) return;
    const part = parts.find(p => p.id === useForm.partId);
    if (!part || useForm.quantity > part.quantity) {
      alert("Not enough stock!");
      return;
    }
    await update(part.id, { quantity: part.quantity - useForm.quantity });
    await createHistory({
      partId: part.id, partName: part.name, truck: useForm.truck,
      quantity: useForm.quantity, totalCost: useForm.quantity * part.cost,
      reason: useForm.reason, date: useForm.date, createdAt: new Date().toISOString()
    });
    setUseModalOpen(false);
    setUseForm({ truck: "", partId: "", quantity: 1, reason: "", date: new Date().toISOString().split("T")[0], notes: "" });
  }

  async function deletePart(id: string) {
    if (!confirm("Delete this part?")) return;
    await remove(id);
  }

  const getStatus = (p: PartDoc) => {
    if (p.quantity === 0) return { text: "Out of Stock", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
    if (p.quantity <= p.minStock) return { text: "Low Stock", color: "#eab308", bg: "rgba(234,179,8,0.15)" };
    return { text: "In Stock", color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
  };

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  const inputStyle = {
    background: "#1a1a2e",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#ffffff",
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none"
  };

  const labelStyle = {
    color: "var(--text-secondary)",
    fontSize: "13px",
    marginBottom: "4px",
    display: "block"
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>Parts Inventory</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Manage parts stock and usage</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setUseModalOpen(true)} className="btn-secondary flex items-center gap-2">
            <Wrench size={18} /> Use Part
          </button>
          <button onClick={() => { setEditingPart(null); resetForm(); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Part
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Total Parts</span>
            <Package size={16} style={{ color: "#22c55e" }} />
          </div>
          <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{parts.reduce((s, p) => s + p.quantity, 0)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Total Value</span>
            <span style={{ color: "#3b82f6" }}>$</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>${totalValue.toLocaleString()}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Low Stock</span>
            <span style={{ color: "#eab308" }}>!</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{lowStock}</div>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => setHistoryModalOpen(true)}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>History</span>
            <History size={16} style={{ color: "#f97316" }} />
          </div>
          <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{history.length}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input type="text" placeholder="Search parts..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg input-dark" style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", color: "white" }} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-4 py-2.5 rounded-lg input-dark" style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", color: "white" }}>
          <option value="all">All Status</option>
          <option value="in-stock">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Photo</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Part</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Qty</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Cost</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map(part => {
                const status = getStatus(part);
                return (
                  <tr key={part.id} className="hover:bg-opacity-50" style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td className="px-4 py-3">
                      {part.imageBase64 ? (
                        <img 
                          src={part.imageBase64} 
                          alt={part.name} 
                          className="w-12 h-12 rounded-lg object-cover"
                          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <Package size={20} style={{ color: "var(--text-muted)" }} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>{part.name}</div>
                      {part.partNumber && <div className="text-xs" style={{ color: "var(--text-muted)" }}>#{part.partNumber}</div>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{part.supplier}</td>
                    <td className="px-4 py-3">
                      <span className={part.quantity <= part.minStock ? "text-yellow-500" : "text-white"}>{part.quantity}</span>
                      <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>/ min {part.minStock}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#22c55e" }}>${part.cost.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ color: status.color, background: status.bg, border: `1px solid ${status.color}30` }}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingPart(part); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-opacity-20" style={{ color: "var(--text-muted)" }}>
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => deletePart(part.id)} className="p-1.5 rounded-lg hover:bg-red-500 hover:bg-opacity-20" style={{ color: "var(--text-muted)" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h2 className="text-xl font-semibold mb-6" style={{ color: "var(--text-primary)" }}>
              {editingPart ? "Edit Part" : "Add New Part"}
            </h2>
            <div className="space-y-4">
              <div>
                <label style={labelStyle}>Part Photo</label>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-24 h-24 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden"
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
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg text-sm font-medium mb-2"
                      style={{ background: "rgba(232,168,56,0.15)", color: "#e8a838", border: "1px solid rgba(232,168,56,0.3)" }}
                    >
                      {imagePreview ? "Change Photo" : "Upload Photo"}
                    </button>
                    {imagePreview && (
                      <button 
                        onClick={clearImage}
                        className="flex items-center gap-1 text-xs ml-2"
                        style={{ color: "#ef4444" }}
                      >
                        <X size={12} /> Remove
                      </button>
                    )}
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Auto-compressed • Max 500KB</p>
                  </div>
                </div>
                {uploadingImage && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#e8a838", borderTopColor: "transparent" }} />
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Processing image...</span>
                  </div>
                )}
                {uploadError && (
                  <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                    ⚠️ {uploadError}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Part Name *</label>
                <input type="text" placeholder="e.g. Hydraulic Pump" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Supplier *</label>
                  <input type="text" placeholder="e.g. Amazon" value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} style={inputStyle}>
                    <option value="engine">Engine</option>
                    <option value="hydraulic">Hydraulic</option>
                    <option value="electrical">Electrical</option>
                    <option value="brake">Brake</option>
                    <option value="tire">Tire/Wheel</option>
                    <option value="body">Body/Frame</option>
                    <option value="transmission">Transmission</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Quantity</label>
                  <input type="number" placeholder="0" value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Min Stock</label>
                  <input type="number" placeholder="5" value={form.minStock} onChange={e => setForm({...form, minStock: parseInt(e.target.value) || 1})} style={inputStyle} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Unit Cost ($)</label>
                  <input type="number" placeholder="0.00" value={form.cost} onChange={e => setForm({...form, cost: parseFloat(e.target.value) || 0})} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Part Number (optional)</label>
                  <input type="text" placeholder="e.g. ABC-123" value={form.partNumber} onChange={e => setForm({...form, partNumber: e.target.value})} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea placeholder="Any additional notes..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} style={{...inputStyle, resize: "vertical"}} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <button onClick={() => { setModalOpen(false); setEditingPart(null); resetForm(); }} className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.05)" }}>Cancel</button>
              <button 
                onClick={savePart} 
                disabled={uploadingImage}
                className="px-6 py-2.5 rounded-lg text-sm font-medium"
                style={{ 
                  background: uploadingImage ? "rgba(232,168,56,0.5)" : "#e8a838", 
                  color: "#1a1a1a",
                  cursor: uploadingImage ? "not-allowed" : "pointer"
                }}
              >
                {uploadingImage ? "Processing..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {useModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="card w-full max-w-lg p-6" style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h2 className="text-xl font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Use Part on Truck</h2>
            <div className="space-y-4">
              <div>
                <label style={labelStyle}>Truck</label>
                <select value={useForm.truck} onChange={e => setUseForm({...useForm, truck: e.target.value})} style={inputStyle}>
                  <option value="">Select Truck...</option>
                  {trucks && trucks.filter(t => t && t.id).map(t => (
                    <option key={t.id} value={`${t.fleetId} - ${t.brand} ${t.model}`}>
                      {t.fleetId} - {t.brand} {t.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Part</label>
                <select value={useForm.partId} onChange={e => setUseForm({...useForm, partId: e.target.value})} style={inputStyle}>
                  <option value="">Select Part...</option>
                  {parts.filter(p => p.quantity > 0).map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Qty: {p.quantity})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Quantity</label>
                  <input type="number" placeholder="1" value={useForm.quantity} onChange={e => setUseForm({...useForm, quantity: parseInt(e.target.value) || 1})} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={useForm.date} onChange={e => setUseForm({...useForm, date: e.target.value})} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Reason / Work Order</label>
                <input type="text" placeholder="e.g. Oil Change" value={useForm.reason} onChange={e => setUseForm({...useForm, reason: e.target.value})} style={inputStyle} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <button onClick={() => setUseModalOpen(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.05)" }}>Cancel</button>
              <button onClick={usePart} className="px-6 py-2.5 rounded-lg text-sm font-medium" style={{ background: "#e8a838", color: "#1a1a1a" }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6" style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Usage History</h2>
              <button onClick={() => setHistoryModalOpen(false)} className="p-2 rounded-lg hover:bg-white hover:bg-opacity-10" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Truck</th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Part</th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Cost</th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(h => (
                    <tr key={h.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{h.date}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 rounded text-xs" style={{ color: "#3b82f6", background: "rgba(59,130,246,0.15)" }}>{h.truck}</span></td>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{h.partName}</td>
                      <td className="px-4 py-3" style={{ color: "#f97316" }}>{h.quantity}</td>
                      <td className="px-4 py-3" style={{ color: "#22c55e" }}>${h.totalCost.toFixed(2)}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{h.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
