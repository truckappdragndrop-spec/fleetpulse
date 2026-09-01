import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { collection, getDocs, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, deleteField, query, orderBy, limit } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useDialogs } from "@/components/Dialogs";
import { nextWorkOrderNumber } from "@/lib/workOrderNumber";
import { itemState } from "@/lib/checklistLink";
import {
  ClipboardCheck, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, RefreshCw, Truck, User, Gauge, Fuel, MinusCircle, Calendar,
  Trash2, Wrench, X, Minus, Plus, Search, ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  labelPt?: string;
  category: string;
  status?: "ok" | "fair" | "bad" | null;
  checked?: boolean;
  notes: string;
  photoUrl?: string;
  woCreated?: boolean;
  woId?: string;
  woNumber?: string;
}

interface ChecklistReport {
  id: string;
  driverName: string;
  driverEmail: string;
  truckId: string;
  truckName: string;
  odometer: number;
  fuelLevel: number;
  issues: string;
  status: string;
  submittedAt: string;
  resolvedAt?: string;
  /** E-mail de quem encerrou o checklist. */
  resolvedBy?: string;
  resolvedItems?: string[];
  issuesResolved?: boolean;
  /** Ordem de serviço aberta a partir do campo livre "Issues". */
  issuesWoNumber?: string;
  /** Confirmação do motorista no envio — o equivalente à assinatura. */
  certified?: boolean;
  certifiedBy?: string;
  certifiedAt?: string;
  /** Problemas do relatório anterior que o motorista declarou ter revisado. */
  acknowledgedIssues?: { id: string; label: string; reportId: string }[];
  acknowledgedAt?: string;
  /** Certificação de reparo: exigida antes do caminhão voltar à rota. */
  repairCertifiedBy?: string;
  repairCertifiedAt?: string;
  checklist: ChecklistItem[];
}

interface PartOption {
  id: string;
  name: string;
  quantity: number;
  cost: number;
}

// Compatível com formato novo (status) e antigo (checked)
function statusStyle(status: string) {
  if (status === "approved")
    return { label: "Approved", color: "var(--accent-green)", bg: "rgba(74,155,106,0.15)" };
  if (status === "resolved")
    return { label: "Resolved ✓", color: "#3b82f6", bg: "rgba(59,130,246,0.15)" };
  return { label: "Needs Review", color: "var(--accent-amber)", bg: "rgba(245,158,11,0.15)" };
}

export default function Checklists() {
  const { confirm, notify } = useDialogs();
  const [reports, setReports] = useState<ChecklistReport[]>([]);
  const [parts, setParts] = useState<PartOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "needs_review" | "approved" | "resolved">("needs_review");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [photoView, setPhotoView] = useState<string | null>(null);

  // Busca por texto (caminhão ou motorista) e ordenação da tabela.
  // Chegando de /checklists?wo=WO-0042 (atalho da tela de Manutenção),
  // a busca já vem preenchida com o número da ordem.
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("wo") || "");

  useEffect(() => {
    const wo = searchParams.get("wo");
    if (!wo) return;
    setSearch(wo);
    setFilter("all");          // a ordem pode ter vindo de um checklist já resolvido
    setDateMode("all");
    searchParams.delete("wo"); // limpa o endereço para não "grudar" a busca
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);
  type ChecklistSortField = "date" | "truck" | "problems";
  const [sortField, setSortField] = useState<ChecklistSortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (field: ChecklistSortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => (d === "desc" ? "asc" : "desc"));
        return prev;
      }
      setSortDir(field === "truck" ? "asc" : "desc");
      return field;
    });
  };

  const sortIcon = (field: ChecklistSortField) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortDir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />;
  };

  // Paginação: antes esta tela baixava TODOS os checklists já enviados a cada
  // vez que era aberta — e a coleção só cresce. Agora vem um lote por vez.
  const PAGE_SIZE = 100;
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);

  // Quick date search (day / month / year)
  const [dateMode, setDateMode] = useState<"all" | "day" | "month" | "year">("all");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  // WO dialog state
  const [woDialog, setWoDialog] = useState<{ report: ChecklistReport; item?: ChecklistItem; fromIssues?: boolean } | null>(null);
  const [woDescription, setWoDescription] = useState("");
  const [woPriority, setWoPriority] = useState("medium");
  const [woLabor, setWoLabor] = useState("");
  const [woQty, setWoQty] = useState<Record<string, number>>({});
  const [woSaving, setWoSaving] = useState(false);

  const loadReports = async (max: number = pageLimit) => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "driverChecklists"), orderBy("submittedAt", "desc"), limit(max))
      );
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChecklistReport));
      list.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
      setReports(list);
      // Se veio o lote cheio, provavelmente ainda há mais no banco.
      setHasMore(snap.size === max);
    } catch (err) {
      console.error("Error loading checklists:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const next = pageLimit + PAGE_SIZE;
    setPageLimit(next);
    loadReports(next);
  };

  const loadParts = async () => {
    try {
      const snap = await getDocs(collection(db, "parts"));
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "Part",
          quantity: Number(data.quantity ?? data.stock ?? 0),
          cost: Number(data.cost ?? data.price ?? 0),
        };
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setParts(list);
    } catch (err) {
      console.error("Error loading parts:", err);
    }
  };

  useEffect(() => { loadReports(); loadParts(); }, []);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this checklist?",
      message: "Deletar este checklist? Esta ação não pode ser desfeita.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await deleteDoc(doc(db, "driverChecklists", id));
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error("Error deleting checklist:", err);
      notify("Could not delete / Não foi possível deletar", "error");
    } finally {
      setBusyId(null);
    }
  };

  /** Quem está operando agora — fica gravado junto com a resolução. */
  const currentUser = () => auth.currentUser?.email || "";

  const handleMarkFixed = async (id: string) => {
    // Defeito de segurança exige certificação escrita antes de o caminhão
    // voltar à rota — não é um "ok" qualquer, é uma declaração.
    const ok = await confirm({
      title: "Certify the repair?",
      message: "Declaro que os defeitos reportados foram reparados, ou que não afetam a operação segura do veículo. Fica registrado com o seu e-mail e a data.",
      confirmLabel: "Certify / Certificar",
    });
    if (!ok) return;

    setBusyId(id);
    try {
      const resolvedAt = new Date().toISOString();
      const resolvedBy = currentUser();
      await updateDoc(doc(db, "driverChecklists", id), {
        status: "resolved",
        resolvedAt,
        resolvedBy,
        repairCertifiedBy: resolvedBy,
        repairCertifiedAt: resolvedAt
      });
      setReports(prev => prev.map(r =>
        r.id === id ? { ...r, status: "resolved", resolvedAt, resolvedBy, repairCertifiedBy: resolvedBy, repairCertifiedAt: resolvedAt } : r
      ));
    } catch (err) {
      console.error("Error updating checklist:", err);
      notify("Could not update / Não foi possível atualizar", "error");
    } finally {
      setBusyId(null);
    }
  };

  // Verifica se não sobrou nada pendente e resolve o checklist automaticamente
  const checkAndResolveIfComplete = async (report: ChecklistReport) => {
    const items = report.checklist || [];
    const resolvedItems = report.resolvedItems || [];
    const hasUnresolvedItems = items.some(i => itemState(i) !== "ok" && !resolvedItems.includes(i.id));
    const hasUnresolvedIssues = report.issues && !report.issuesResolved;

    if (!hasUnresolvedItems && !hasUnresolvedIssues) {
      const resolvedAt = new Date().toISOString();
      const resolvedBy = currentUser();
      await updateDoc(doc(db, "driverChecklists", report.id), {
        status: "resolved",
        resolvedAt,
        resolvedBy
      });
      setReports(prev => prev.map(r =>
        r.id === report.id ? { ...r, status: "resolved", resolvedAt, resolvedBy } : r
      ));
    }
  };

  // Marca/desmarca um item individual como fixed
  const handleMarkItemFixed = async (reportId: string, itemId: string) => {
    setBusyId(reportId);
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;
      const currentResolved = report.resolvedItems || [];
      const isCurrentlyResolved = currentResolved.includes(itemId);
      const newResolved = isCurrentlyResolved
        ? currentResolved.filter(id => id !== itemId)
        : [...currentResolved, itemId];

      // Se estava "resolved" e estamos desfazendo, volta para "needs_review"
      const undoingResolved = report.status === "resolved" && isCurrentlyResolved;

      await updateDoc(doc(db, "driverChecklists", reportId), {
        resolvedItems: newResolved,
        ...(undoingResolved ? { status: "needs_review", resolvedAt: deleteField() } : {})
      });

      const updatedReport: ChecklistReport = {
        ...report,
        resolvedItems: newResolved,
        ...(undoingResolved ? { status: "needs_review", resolvedAt: undefined } : {})
      };

      setReports(prev => prev.map(r => r.id === reportId ? updatedReport : r));

      // Se acabamos de marcar como fixed (não undo), verifica se resolve tudo
      if (!isCurrentlyResolved) {
        await checkAndResolveIfComplete(updatedReport);
      }
    } catch (err) {
      console.error("Error updating item:", err);
      notify("Could not update item / Não foi possível atualizar item", "error");
    } finally {
      setBusyId(null);
    }
  };

  // Marca/desmarca os Issues Reported como fixed
  const handleMarkIssuesFixed = async (reportId: string) => {
    setBusyId(reportId);
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;
      const newIssuesResolved = !report.issuesResolved;

      // Se estava "resolved" e estamos desfazendo, volta para "needs_review"
      const undoingResolved = report.status === "resolved" && !newIssuesResolved;

      await updateDoc(doc(db, "driverChecklists", reportId), {
        issuesResolved: newIssuesResolved,
        ...(undoingResolved ? { status: "needs_review", resolvedAt: deleteField() } : {})
      });

      const updatedReport: ChecklistReport = {
        ...report,
        issuesResolved: newIssuesResolved,
        ...(undoingResolved ? { status: "needs_review", resolvedAt: undefined } : {})
      };

      setReports(prev => prev.map(r => r.id === reportId ? updatedReport : r));

      if (newIssuesResolved) {
        await checkAndResolveIfComplete(updatedReport);
      }
    } catch (err) {
      console.error("Error updating issues:", err);
      notify("Could not update issues / Não foi possível atualizar issues", "error");
    } finally {
      setBusyId(null);
    }
  };

  // ===== Work Order =====
  const openWoDialog = (report: ChecklistReport, item?: ChecklistItem, fromIssues?: boolean) => {
    setWoDialog({ report, item, fromIssues });
    if (fromIssues && report.issues) {
      setWoDescription(`${report.issues}\nReported by ${report.driverName || report.driverEmail} on ${formatDate(report.submittedAt)}`);
      setWoPriority("high");
    } else if (item) {
      setWoDescription(`${item.label}${item.notes ? " - " + item.notes : ""}\nReported by ${report.driverName || report.driverEmail} on ${formatDate(report.submittedAt)}`);
      setWoPriority(itemState(item) === "bad" ? "high" : "medium");
    }
    setWoLabor("");
    setWoQty({});
  };

  const woPartsPreview = parts
    .filter(p => (woQty[p.id] || 0) > 0)
    .map(p => ({ ...p, qty: woQty[p.id] }));
  const woPartsTotal = woPartsPreview.reduce((sum, p) => sum + p.qty * p.cost, 0);
  const woGrandTotal = woPartsTotal + (Number(woLabor) || 0);

  const handleCreateWO = async () => {
    if (!woDialog || woSaving) return;
    setWoSaving(true);
    try {
      const { report, item, fromIssues } = woDialog;
      const woParts = woPartsPreview.map(p => ({ id: p.id, name: p.name, qty: p.qty, unitCost: p.cost }));

      // Reserva o número antes de gravar, para que ele já nasça no registro.
      const { number: woNumber, provisional } = await nextWorkOrderNumber();

      const woRef = await addDoc(collection(db, "maintenance"), {
        woNumber,
        truckId: report.truckId,
        truckName: report.truckName || report.truckId,
        title: fromIssues ? "Issues from Driver Checklist" : (item?.label || "Checklist Issue"),
        description: woDescription,
        type: "corrective",
        status: "pending",
        priority: woPriority,
        date: new Date().toISOString().split("T")[0],
        mileage: report.odometer || 0,
        provider: "",
        mechanic: "",
        cost: Number(woLabor) || 0,
        partsCost: woPartsTotal,
        partIds: [],
        woParts,
        notes: "Created from driver checklist",
        checklistId: report.id,
        checklistItemId: item?.id || null,
        createdAt: serverTimestamp(),
      });

      // Baixa no estoque
      for (const wp of woParts) {
        const part = parts.find(p => p.id === wp.id);
        if (part) {
          await updateDoc(doc(db, "parts", wp.id), { quantity: Math.max(0, part.quantity - wp.qty) });
        }
      }

      // WO aberta a partir do campo livre "Issues": o número fica no relatório.
      if (!item) {
        await updateDoc(doc(db, "driverChecklists", report.id), { issuesWoNumber: woNumber });
        setReports(prev => prev.map(r => r.id === report.id ? { ...r, issuesWoNumber: woNumber } : r));
      }

      // Marca o item do checklist como WO criada (se for de um item específico)
      if (item) {
        const updatedChecklist = (report.checklist || []).map(ci =>
          ci.id === item.id ? { ...ci, woCreated: true, woId: woRef.id, woNumber } : ci
        );
        await updateDoc(doc(db, "driverChecklists", report.id), { checklist: updatedChecklist });
        setReports(prev => prev.map(r => r.id === report.id ? { ...r, checklist: updatedChecklist } : r));
      }

      setParts(prev => prev.map(p => (woQty[p.id] || 0) > 0 ? { ...p, quantity: Math.max(0, p.quantity - (woQty[p.id] || 0)) } : p));
      setWoDialog(null);
      notify(
        provisional
          ? `${woNumber} created with a temporary number / número provisório`
          : `${woNumber} created / criada`,
        provisional ? "warning" : "success"
      );
    } catch (err) {
      console.error("Error creating WO:", err);
      notify("Could not create Work Order / Não foi possível criar a WO", "error");
    } finally {
      setWoSaving(false);
    }
  };

  const counts = {
    all: reports.length,
    needs_review: reports.filter(r => r.status === "needs_review").length,
    approved: reports.filter(r => r.status === "approved").length,
    resolved: reports.filter(r => r.status === "resolved").length,
  };

  const ymdOf = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { ymd: "", ym: "", y: "" };
    const y = d.getFullYear();
    const ym = y + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const ymd = ym + "-" + String(d.getDate()).padStart(2, "0");
    return { ymd, ym, y: String(y) };
  };

  const years = Array.from(new Set(reports.map(r => ymdOf(r.submittedAt).y).filter(Boolean))).sort().reverse();

  const statusFiltered = reports.filter(r => filter === "all" ? true : r.status === filter);
  const filtered = statusFiltered.filter(r => {
    if (dateMode === "all") return true;
    const { ymd, ym, y } = ymdOf(r.submittedAt);
    if (!ymd) return false;
    if (dateMode === "day") return dayFilter ? ymd === dayFilter : true;
    if (dateMode === "month") return monthFilter ? ym === monthFilter : true;
    if (dateMode === "year") return yearFilter ? y === yearFilter : true;
    return true;
  });

  // Quantos itens ainda precisam de atenção neste checklist.
  const attentionCountOf = (r: ChecklistReport) => {
    const resolved = r.resolvedItems || [];
    return (r.checklist || []).filter(i => itemState(i) !== "ok" && !resolved.includes(i.id)).length;
  };

  const term = search.trim().toLowerCase();
  const searched = !term
    ? filtered
    : filtered.filter(r => {
        const fields = [r.truckName, r.truckId, r.driverName, r.driverEmail, r.issuesWoNumber];
        if (fields.some(v => (v || "").toLowerCase().includes(term))) return true;
        // Também encontra pelo número da ordem de serviço gerada a partir
        // de um item — é assim que se volta do papel para o checklist.
        return (r.checklist || []).some(i => (i.woNumber || "").toLowerCase().includes(term));
      });

  const sorted = [...searched].sort((a, b) => {
    const dir = sortDir === "desc" ? -1 : 1;
    if (sortField === "truck") {
      return (a.truckName || a.truckId || "").localeCompare(b.truckName || b.truckId || "", undefined, { numeric: true }) * dir;
    }
    if (sortField === "problems") {
      return (attentionCountOf(a) - attentionCountOf(b)) * dir;
    }
    return (a.submittedAt || "").localeCompare(b.submittedAt || "") * dir;
  });

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit"
      });
    } catch {
      return iso;
    }
  };

  const filterLabels: Record<string, string> = {
    needs_review: "Needs Review",
    approved: "Approved",
    resolved: "Resolved",
    all: "All",
  };

  const dateModeLabels: Record<string, string> = {
    all: "All Dates / Todas",
    day: "Day / Dia",
    month: "Month / Mês",
    year: "Year / Ano",
  };

  const todayLocal = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <ClipboardCheck style={{ color: "var(--accent-green)" }} /> Driver Checklists
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {counts.needs_review} pending review • {counts.all} total
          </p>
        </div>
        <button
          onClick={() => { loadReports(); loadParts(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-divider)" }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Busca + status na mesma faixa, para o dado aparecer mais cedo na tela */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search truck, driver or WO # / Buscar caminhão, motorista ou WO..."
            className="w-full pl-9 pr-8 py-2 rounded-lg text-sm"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(["needs_review", "approved", "resolved", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
              style={{
                background: filter === f ? "var(--accent-green)" : "var(--bg-secondary)",
                color: filter === f ? "#fff" : "var(--text-secondary)",
                border: "1px solid var(--border-divider)"
              }}
            >
              {filterLabels[f]} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* Quick date search */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: "var(--text-muted)" }}>
          <Calendar size={14} /> Date / Data:
        </span>
        {(["all", "day", "month", "year"] as const).map(m => (
          <button
            key={m}
            onClick={() => {
              setDateMode(m);
              if (m === "day" && !dayFilter) setDayFilter(todayLocal());
              if (m === "month" && !monthFilter) setMonthFilter(todayLocal().slice(0, 7));
              if (m === "year" && !yearFilter) setYearFilter(String(new Date().getFullYear()));
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: dateMode === m ? "var(--accent-amber)" : "var(--bg-secondary)",
              color: dateMode === m ? "#fff" : "var(--text-secondary)",
              border: "1px solid var(--border-divider)"
            }}
          >
            {dateModeLabels[m]}
          </button>
        ))}
        {dateMode === "day" && (
          <input
            type="date"
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)", colorScheme: "dark" }}
          />
        )}
        {dateMode === "month" && (
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)", colorScheme: "dark" }}
          />
        )}
        {dateMode === "year" && (
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
          >
            {years.length === 0 && <option value={yearFilter}>{yearFilter}</option>}
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {dateMode !== "all" && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {sorted.length} checklist{sorted.length !== 1 ? "s" : ""} found / encontrado{sorted.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent-green)", borderTopColor: "transparent" }} />
        </div>
      ) : sorted.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <ClipboardCheck size={48} className="mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-muted)" }}>
            {dateMode !== "all" ? "No checklists found for this date / Nenhum checklist nessa data." : filter === "needs_review" ? "No checklists pending review 🎉" : "No checklists found."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tabela compacta: uma linha por checklist, cabeçalhos ordenáveis */}
          <div className="glass-card overflow-hidden">
            <div
              className="hidden md:grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_88px_128px_92px] gap-4 px-4 py-2.5"
              style={{ borderBottom: "1px solid var(--border-divider)" }}
            >
              {([
                { field: "truck", label: "Truck / Caminhão" },
                { field: "date", label: "Date / Data" },
                { field: "problems", label: "Issues" },
              ] as { field: ChecklistSortField; label: string }[]).map(col => (
                <button
                  key={col.field}
                  onClick={() => toggleSort(col.field)}
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-left"
                  style={{ color: sortField === col.field ? "var(--accent-amber)" : "var(--text-muted)" }}
                  title="Click to sort / Clique para ordenar"
                >
                  {col.label} {sortIcon(col.field)}
                </button>
              ))}
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</p>
              <span />
            </div>

            {sorted.map(report => {
              const items = report.checklist || [];
              const resolvedItems = report.resolvedItems || [];
              const attention = items.filter(i => itemState(i) !== "ok" && !resolvedItems.includes(i.id));
              const isOpen = expanded === report.id;
              const st = statusStyle(report.status);
              const itemsToShow = (filter === "all" || report.status === "approved") ? items : attention;

              return (
                <div
                  key={report.id}
                  style={{
                    opacity: busyId === report.id ? 0.6 : 1,
                    borderBottom: "1px solid var(--border-divider)",
                  }}
                >
                  {/* Linha */}
                  <div
                    className="px-4 py-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_88px_128px_92px] md:gap-4 md:items-center cursor-pointer"
                    style={{ background: isOpen ? "rgba(255,255,255,0.03)" : "transparent" }}
                    onClick={() => setExpanded(isOpen ? null : report.id)}
                  >
                    {/* Caminhão + motorista */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        aria-hidden
                        className="rounded-full flex-shrink-0"
                        style={{ width: 8, height: 8, background: st.color }}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>
                          {report.truckName || report.truckId}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {report.driverName || report.driverEmail}
                        </p>
                        {/* No celular, data e status entram aqui embaixo */}
                        <p className="text-xs mt-0.5 md:hidden" style={{ color: "var(--text-muted)" }}>
                          {formatDate(report.submittedAt)} • {st.label}
                          {attention.length > 0 ? ` • ${attention.length} issues` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Data */}
                    <p className="hidden md:block text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                      {formatDate(report.submittedAt)}
                    </p>

                    {/* Problemas em aberto */}
                    <div className="hidden md:block">
                      {attention.length > 0 ? (
                        <span
                          className="mono-font text-xs font-bold px-2 py-0.5 rounded-md"
                          style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
                        >
                          {attention.length}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="hidden md:block">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block whitespace-nowrap"
                        style={{ background: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-0.5 justify-end">
                      {report.status === "needs_review" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkFixed(report.id); }}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                          style={{ color: "#3b82f6" }}
                          title="Mark as Fixed / Marcar como Arrumado"
                        >
                          <Wrench size={16} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        title="Delete / Deletar"
                      >
                        <Trash2 size={16} />
                      </button>
                      {isOpen
                        ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
                        : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
                    </div>
                  </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--border-divider)" }}>
                    {/* Resolved banner */}
                    {report.status === "resolved" && report.resolvedAt && (
                      <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)" }}>
                        <p className="text-xs font-semibold" style={{ color: "#3b82f6" }}>
                          ✓ MARKED AS FIXED on {formatDate(report.resolvedAt)}
                          {report.resolvedBy ? ` by ${report.resolvedBy}` : ""}
                        </p>
                      </div>
                    )}

                    {/* Info row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4">
                      <InfoBox icon={<User size={14} />} label="Driver" value={report.driverName || report.driverEmail} />
                      <InfoBox icon={<Truck size={14} />} label="Truck" value={report.truckName || report.truckId} />
                      <InfoBox icon={<Gauge size={14} />} label="Odometer" value={`${report.odometer} mi`} />
                      <InfoBox icon={<Fuel size={14} />} label="Fuel Level" value={`${report.fuelLevel}%`} />
                    </div>

                    <div className="mb-4 space-y-1">
                      {report.certified && (
                        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--accent-green)" }}>
                          <CheckCircle2 size={13} />
                          Inspection certified by {report.certifiedBy || report.driverName || report.driverEmail}
                          {report.certifiedAt ? ` on ${formatDate(report.certifiedAt)}` : ""}
                        </p>
                      )}
                      {report.acknowledgedAt && (
                        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--accent-amber)" }}>
                          <CheckCircle2 size={13} />
                          Driver reviewed {report.acknowledgedIssues?.length || 0} open issue
                          {(report.acknowledgedIssues?.length || 0) !== 1 ? "s" : ""} from the previous report
                          {` on ${formatDate(report.acknowledgedAt)}`}
                        </p>
                      )}
                      {report.repairCertifiedBy && (
                        <p className="text-xs flex items-center gap-1.5" style={{ color: "#3b82f6" }}>
                          <Wrench size={13} />
                          Repairs certified by {report.repairCertifiedBy}
                          {report.repairCertifiedAt ? ` on ${formatDate(report.repairCertifiedAt)}` : ""}
                        </p>
                      )}
                    </div>

                    {/* Issues */}
                    {report.issues && (
                      <div className="mb-4 p-3 rounded-lg" style={{
                        background: report.issuesResolved ? "rgba(74,155,106,0.08)" : "rgba(239,68,68,0.1)",
                        border: report.issuesResolved ? "1px solid rgba(74,155,106,0.3)" : "1px solid rgba(239,68,68,0.3)",
                        opacity: report.issuesResolved ? 0.7 : 1
                      }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-xs font-semibold mb-1" style={{ color: report.issuesResolved ? "var(--accent-green)" : "#ef4444" }}>
                              {report.issuesResolved ? "✓ ISSUES RESOLVED" : "ISSUES REPORTED"}
                            </p>
                            <p className="text-sm" style={{ color: "var(--text-primary)", textDecoration: report.issuesResolved ? "line-through" : "none" }}>
                              {report.issues}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                            {report.issuesWoNumber && (
                              <span
                                className="mono-font text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap flex items-center gap-1 flex-shrink-0 mt-0.5"
                                style={{ background: "rgba(74,155,106,0.15)", color: "var(--accent-green)" }}
                                title="Work order created / Ordem de serviço criada"
                              >
                                <Wrench size={11} /> {report.issuesWoNumber}
                              </span>
                            )}
                            {report.status === "needs_review" && !report.issuesResolved && !report.issuesWoNumber && (
                              <button
                                onClick={() => openWoDialog(report, undefined, true)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold flex-shrink-0 mt-0.5"
                                style={{ background: "rgba(74,155,106,0.15)", color: "var(--accent-green)", border: "1px solid rgba(74,155,106,0.4)" }}
                              >
                                <Wrench size={12} /> Create WO
                              </button>
                            )}
                            {report.status === "needs_review" && (
                              <button
                                onClick={() => handleMarkIssuesFixed(report.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                                style={{
                                  background: report.issuesResolved ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.15)",
                                  color: report.issuesResolved ? "#ef4444" : "#3b82f6",
                                  border: `1px solid ${report.issuesResolved ? "rgba(239,68,68,0.3)" : "rgba(59,130,246,0.3)"}`
                                }}
                                title={report.issuesResolved ? "Undo Fixed / Desfazer" : "Mark Fixed / Marcar como Arrumado"}
                              >
                                {report.issuesResolved ? <X size={12} /> : <CheckCircle2 size={12} />}
                                {report.issuesResolved ? "Undo" : "Fixed"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    {filter !== "all" && report.status !== "approved" && (
                      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                        ITEMS THAT NEED ATTENTION ({attention.length})
                      </p>
                    )}
                    <div className="space-y-1">
                      {itemsToShow.length === 0 ? (
                        <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>All items OK.</p>
                      ) : (
                        itemsToShow.map(item => {
                          const state = itemState(item);
                          const isResolved = resolvedItems.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              className="flex items-start gap-2 py-1.5 px-2 rounded"
                              style={{
                                background: isResolved ? "rgba(74,155,106,0.08)" :
                                  state === "ok" ? "transparent" :
                                  state === "fair" ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)",
                                opacity: isResolved ? 0.6 : 1,
                                border: isResolved ? "1px solid rgba(74,155,106,0.3)" : "none"
                              }}
                            >
                              {isResolved && <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent-green)" }} />}
                              {!isResolved && state === "ok" && <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent-green)" }} />}
                              {!isResolved && state === "fair" && <MinusCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent-amber)" }} />}
                              {!isResolved && state === "bad" && <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }} />}
                              <div className="flex-1">
                                <span className="text-sm" style={{ color: "var(--text-primary)", textDecoration: isResolved ? "line-through" : "none" }}>
                                  {item.label}
                                  {state !== "ok" && !isResolved && (
                                    <span
                                      className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded"
                                      style={{
                                        background: state === "fair" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                                        color: state === "fair" ? "var(--accent-amber)" : "#ef4444"
                                      }}
                                    >
                                      {state === "fair" ? "FAIR" : "BAD"}
                                    </span>
                                  )}
                                  {isResolved && (
                                    <span
                                      className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded"
                                      style={{ background: "rgba(74,155,106,0.15)", color: "var(--accent-green)" }}
                                    >
                                      FIXED
                                    </span>
                                  )}
                                </span>
                                {item.labelPt && (
                                  <p className="text-xs" style={{ color: "var(--text-muted)", textDecoration: isResolved ? "line-through" : "none" }}>{item.labelPt}</p>
                                )}
                                {item.notes && (
                                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Note: {item.notes}</p>
                                )}
                                {item.photoUrl && (
                                  <img
                                    src={item.photoUrl}
                                    alt="Issue"
                                    className="mt-1 rounded cursor-pointer"
                                    style={{ maxWidth: 120, border: "1px solid var(--border-divider)" }}
                                    onClick={() => setPhotoView(item.photoUrl || null)}
                                  />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                                {report.status === "needs_review" && state !== "ok" && !item.woCreated && !isResolved && (
                                  <button
                                    onClick={() => openWoDialog(report, item)}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                                    style={{ background: "rgba(74,155,106,0.15)", color: "var(--accent-green)", border: "1px solid rgba(74,155,106,0.4)" }}
                                  >
                                    <Wrench size={12} /> Create WO
                                  </button>
                                )}
                                {item.woCreated && (
                                  <span
                                    className="mono-font text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap flex items-center gap-1"
                                    style={{ background: "rgba(74,155,106,0.15)", color: "var(--accent-green)" }}
                                    title="Work order created for this item / Ordem de serviço criada para este item"
                                  >
                                    <Wrench size={11} /> {item.woNumber || "WO ✓"}
                                  </span>
                                )}
                                {report.status === "needs_review" && state !== "ok" && (
                                  <button
                                    onClick={() => handleMarkItemFixed(report.id, item.id)}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                                    style={{
                                      background: isResolved ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.15)",
                                      color: isResolved ? "#ef4444" : "#3b82f6",
                                      border: `1px solid ${isResolved ? "rgba(239,68,68,0.3)" : "rgba(59,130,246,0.3)"}`
                                    }}
                                    title={isResolved ? "Undo Fixed / Desfazer" : "Mark Fixed / Marcar como Arrumado"}
                                  >
                                    {isResolved ? <X size={12} /> : <CheckCircle2 size={12} />}
                                    {isResolved ? "Undo" : "Fixed"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: "var(--border-divider)" }}>
                      {report.status === "needs_review" && (
                        <button
                          onClick={() => handleMarkFixed(report.id)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                          style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)" }}
                        >
                          <Wrench size={16} /> Mark All as Fixed / Marcar Tudo como Arrumado
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
                      >
                        <Trash2 size={16} /> Delete / Deletar
                      </button>
                    </div>
                  </div>
                )}
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button onClick={loadMore} disabled={loading} className="btn-ghost text-sm">
                {loading
                  ? "Loading... / Carregando..."
                  : `Load older checklists / Carregar mais antigos (+${PAGE_SIZE})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== Create WO Dialog ===== */}
      {woDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <Wrench size={20} style={{ color: "var(--accent-green)" }} /> Create Work Order
              </h2>
              <button onClick={() => setWoDialog(null)} className="p-1 rounded hover:bg-white/10" style={{ color: "var(--text-muted)" }}>
                <X size={20} />
              </button>
            </div>

            {/* Info */}
            <div className="p-3 rounded-lg mb-4" style={{ background: "var(--bg-secondary)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {woDialog.report.truckName || woDialog.report.truckId}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--accent-amber)" }}>
                {woDialog.fromIssues ? "Issues Reported" : woDialog.item?.label}
              </p>
              {woDialog.item?.labelPt && !woDialog.fromIssues && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{woDialog.item.labelPt}</p>
              )}
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Service description / Descrição do serviço</label>
              <textarea
                value={woDescription}
                onChange={(e) => setWoDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Priority + Labor */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Priority / Prioridade</label>
                <select
                  value={woPriority}
                  onChange={(e) => setWoPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
                >
                  <option value="low">Low / Baixa</option>
                  <option value="medium">Medium / Média</option>
                  <option value="high">High / Alta</option>
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Labor cost / Mão de obra ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={woLabor}
                  onChange={(e) => setWoLabor(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
                />
              </div>
            </div>

            {/* Parts */}
            <div className="mb-4">
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>
                Parts from inventory / Peças do estoque
              </label>
              <div className="rounded-lg p-2 space-y-1 max-h-48 overflow-y-auto" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)" }}>
                {parts.filter(p => p.quantity > 0).length === 0 ? (
                  <p className="text-xs py-2 text-center" style={{ color: "var(--text-muted)" }}>No parts in stock / Sem peças no estoque</p>
                ) : (
                  parts.filter(p => p.quantity > 0).map(p => {
                    const qty = woQty[p.id] || 0;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded"
                        style={{ background: qty > 0 ? "rgba(74,155,106,0.1)" : "transparent" }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Stock: {p.quantity} • ${p.cost.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setWoQty(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1) }))}
                            disabled={qty === 0}
                            className="w-7 h-7 rounded flex items-center justify-center"
                            style={{ background: "var(--bg-primary)", color: qty === 0 ? "var(--text-muted)" : "#ef4444", border: "1px solid var(--border-divider)", opacity: qty === 0 ? 0.4 : 1 }}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-semibold w-5 text-center" style={{ color: "var(--text-primary)" }}>{qty}</span>
                          <button
                            onClick={() => setWoQty(prev => ({ ...prev, [p.id]: Math.min(p.quantity, (prev[p.id] || 0) + 1) }))}
                            disabled={qty >= p.quantity}
                            className="w-7 h-7 rounded flex items-center justify-center"
                            style={{ background: "var(--bg-primary)", color: qty >= p.quantity ? "var(--text-muted)" : "var(--accent-green)", border: "1px solid var(--border-divider)", opacity: qty >= p.quantity ? 0.4 : 1 }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Totals */}
            <div className="p-3 rounded-lg mb-4 text-sm" style={{ background: "var(--bg-secondary)" }}>
              <div className="flex justify-between" style={{ color: "var(--text-secondary)" }}>
                <span>Parts / Peças:</span><span>${woPartsTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between" style={{ color: "var(--text-secondary)" }}>
                <span>Labor / Mão de obra:</span><span>${(Number(woLabor) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold mt-1 pt-1 border-t" style={{ color: "var(--accent-green)", borderColor: "var(--border-divider)" }}>
                <span>Total:</span><span>${woGrandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setWoDialog(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-divider)" }}
              >
                Cancel / Cancelar
              </button>
              <button
                onClick={handleCreateWO}
                disabled={woSaving}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: "var(--accent-green)", color: "#fff", opacity: woSaving ? 0.6 : 1 }}
              >
                {woSaving ? "Creating... / Criando..." : "Create WO / Criar WO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visualizador de foto */}
      {photoView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setPhotoView(null)}
        >
          <img src={photoView} alt="Issue" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}

function InfoBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
      <p className="text-xs flex items-center gap-1 mb-1" style={{ color: "var(--text-muted)" }}>
        {icon} {label}
      </p>
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}
