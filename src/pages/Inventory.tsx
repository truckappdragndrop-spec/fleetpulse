import { useState, useEffect } from "react";
import { useCollection } from "@/hooks/useCollection";
import { Plus, Search, Package, Wrench, Trash2, Edit3, History, X, AlertTriangle, DollarSign } from "lucide-react";

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
}

const categories = [
  { value: "engine", label: "Engine" },
  { value: "hydraulic", label: "Hydraulic" },
  { value: "electrical", label: "Electrical" },
  { value: "brake", label: "Brake System" },
  { value: "tire", label: "Tire/Wheel" },
  { value: "body", label: "Body/Frame" },
  { value: "transmission", label: "Transmission" },
  { value: "other", label: "Other" },
];

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
    name: "", supplier: "", category: "engine", quantity: 0, minStock: 5, cost: 0, partNumber: "", notes: ""
  });
  
  const [useForm, setUseForm] = useState({
    truck: "", partId: "", quantity: 1, reason: "", date: new Date().toISOString().split("T")[0], notes: ""
  });

  const trucks = ["Truck 1 - Roll Off #1", "Truck 2 - Roll Off #2", "Truck 3 - Roll Off #3"];

  useEffect(() => {
    if (editingPart) {
      setForm({
        name: editingPart.name, supplier: editingPart.supplier, category: editingPart.category,
        quantity: editingPart.quantity, minStock: editingPart.minStock, cost: editingPart.cost,
        partNumber: editingPart.partNumber || "", notes: editingPart.notes || ""
      });
n    }
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
  const totalQty = parts.reduce((sum, p) => sum + p.quantity, 0);

  async function savePart() {
    if (!form.name || !form.supplier) return;
    const data = { ...form };
    if (editingPart) {
      await update(editingPart.id, data);
      setEditingPart(null);
    } else {
      await create(data);
    }
    setModalOpen(false);
    setForm({ name: "", supplier: "", category: "engine", quantity: 0, minStock: 5, cost: 0, partNumber: "", notes: "" });
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
      reason: useForm.reason, date: useForm.date
    });
    setUseModalOpen(false);
    setUseForm({ truck: "", partId: "", quantity: 1, reason: "", date: new Date().toISOString().split("T")[0], notes: "" });
  }

  async function deletePart(id: string) {
    if (!confirm("Delete this part?")) return;
    await remove(id);
  }

  const getStatus = (p: PartDoc) => {
    if (p.quantity === 0) return { text: "Out", color: "text-red-400", bg: "bg-red-500/10" };
    if (p.quantity <= p.minStock) return { text: "Low", color: "text-amber-400", bg: "bg-amber-500/10" };
    return { text: "OK", color: "text-emerald-400", bg: "bg-emerald-500/10" };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white" style={{ letterSpacing: "-0.02em" }}>Parts Inventory</h1>
          <p className="text-gray-400 text-sm">Manage parts stock and usage</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setUseModalOpen(true)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm flex items-center gap-2 transition-colors">
            <Wrench size={18} /> Use Part
          </button>
          <button onClick={() => { setEditingPart(null); setModalOpen(true); }} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium text-sm flex items-center gap-2 transition-colors">
            <Plus size={18} /> Add Part
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-xl p-4 border border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Package size={20} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-emerald-400 font-mono">{totalQty}</p>
            <p className="text-xs text-gray-500">Total Parts</p>
          </div>
        </div>
        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-xl p-4 border border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <DollarSign size={20} className="text-amber-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-amber-400 font-mono">${totalValue.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total Value</p>
          </div>
        </div>
        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-xl p-4 border border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-amber-400 font-mono">{lowStock}</p>
            <p className="text-xs text-gray-500">Low Stock</p>
          </div>
        </div>
        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-xl p-4 border border-white/5 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setHistoryModalOpen(true)}>
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <History size={20} className="text-orange-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-orange-400 font-mono">{history.length}</p>
            <p className="text-xs text-gray-500">History</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
n          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search parts..." className="w-full bg-neutral-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-neutral-900/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50">
          <option value="all">All Status</option>
          <option value="in-stock">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      <div className="bg-neutral-900/50 backdrop-blur-sm rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
n              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Part</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8"><div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></td></tr>
              ) : filteredParts.length > 0 ? filteredParts.map((part) => {
                const status = getStatus(part);
                return (
                  <tr key={part.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{part.name}</div>
                      {part.partNumber && <div className="text-xs text-gray-500 font-mono">#{part.partNumber}</div>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">{part.supplier}</td>
                    <td className="px-5 py-4"><span className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-400">{categories.find(c => c.value === part.category)?.label}</span></td>
                    <td className="px-5 py-4"><span className={`font-mono font-medium ${part.quantity <= part.minStock ? 'text-amber-400' : 'text-white'}`}>{part.quantity}</span><span className="text-xs text-gray-500 ml-1">/ min {part.minStock}</span></td>
                    <td className="px-5 py-4 text-emerald-400 font-mono text-sm">${part.cost.toFixed(2)}</td>
                    <td className="px-5 py-4"><span className={`text-xs px-2 py-1 rounded-md font-medium ${status.bg} ${status.color}`}>{status.text}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingPart(part); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"><Edit3 size={14} /></button>
                        <button onClick={() => deletePart(part.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500"><Package size={48} className="mx-auto mb-3 opacity-30" /><p>No parts found</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setModalOpen(false); setEditingPart(null); }} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-neutral-900 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">{editingPart ? "Edit Part" : "Add New Part"}</h2>
              <button onClick={() => { setModalOpen(false); setEditingPart(null); }} className="p-1 text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Part Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" placeholder="e.g., Hydraulic Pump" />
n              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Supplier *</label>
                  <input type="text" value={form.supplier} onChange={(e) => setForm({...form, supplier: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" placeholder="e.g., Napa Auto Parts" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category *</label>
                  <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50">
                    {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Quantity *</label>
                  <input type="number" value={form.quantity} onChange={(e) => setForm({...form, quantity: parseInt(e.target.value) || 0})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50" min="0" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Min Stock</label>
                  <input type="number" value={form.minStock} onChange={(e) => setForm({...form, minStock: parseInt(e.target.value) || 1})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50" min="1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Unit Cost ($) *</label>
                  <input type="number" value={form.cost} onChange={(e) => setForm({...form, cost: parseFloat(e.target.value) || 0})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50" min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Part Number</label>
                  <input type="text" value={form.partNumber} onChange={(e) => setForm({...form, partNumber: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50" placeholder="Optional SKU" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" rows={2} placeholder="Additional details..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => { setModalOpen(false); setEditingPart(null); }} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={savePart} className="px-6 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-400 text-black font-medium transition-colors">{editingPart ? "Update" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {useModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setUseModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl p-6 bg-neutral-900 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Use Part on Truck</h2>
              <button onClick={() => setUseModalOpen(false)} className="p-1 text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Select Truck *</label>
                <select value={useForm.truck} onChange={(e) => setUseForm({...useForm, truck: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50">
                  <option value="">Choose truck...</option>
                  {trucks.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Select Part *</label>
                <select value={useForm.partId} onChange={(e) => setUseForm({...useForm, partId: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50">
                  <option value="">Choose part...</option>
                  {parts.filter(p => p.quantity > 0).map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Qty: {p.quantity})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Quantity to Use *</label>
                  <input type="number" value={useForm.quantity} onChange={(e) => setUseForm({...useForm, quantity: parseInt(e.target.value) || 1})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50" min="1" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Date</label>
                  <input type="date" value={useForm.date} onChange={(e) => setUseForm({...useForm, date: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Work Order / Reason</label>
                <input type="text" value={useForm.reason} onChange={(e) => setUseForm({...useForm, reason: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" placeholder="e.g., Routine maintenance" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea value={useForm.notes} onChange={(e) => setUseForm({...useForm, notes: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" rows={2} placeholder="Details about usage..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setUseModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={usePart} className="px-6 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-400 text-black font-medium transition-colors">Confirm Usage</button>
            </div>
          </div>
        </div>
      )}

      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setHistoryModalOpen(false)} />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-neutral-900 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Usage History</h2>
              <button onClick={() => setHistoryModalOpen(false)} className="p-1 text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Truck</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Part</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(h => (
                    <tr key={h.id} className="border-b border-white/5">
                      <td className="px-4 py-3 text-sm text-gray-400 font-mono">{h.date}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-md bg-blue-500/10 text-blue-400">{h.truck}</span></td>
                      <td className="px-4 py-3 font-medium text-white text-sm">{h.partName}</td>
                      <td className="px-4 py-3 text-amber-400 font-mono text-sm">{h.quantity}</td>
                      <td className="px-4 py-3 text-emerald-400 font-mono text-sm">${h.totalCost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{h.reason || "-"}</td>
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
