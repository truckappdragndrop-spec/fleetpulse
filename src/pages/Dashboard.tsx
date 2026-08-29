import { useState, useEffect, useMemo } from "react";
import { useCollection } from "@/hooks/useCollection";
import { Link } from "react-router";
import {
  Wrench, Droplets, AlertTriangle, ChevronRight,
  DollarSign, TrendingUp, TrendingDown, Gauge, Award, Zap, Activity,
  BarChart3, ArrowUpRight, ArrowDownRight, Circle, CheckCircle2,
  XCircle, Clock, Fuel, Bell, X, Calendar, Printer, RotateCcw,
  ChevronLeft, ChevronDown, FileText, BarChart, PieChart, Filter,
  ArrowLeft, ArrowRight, ChevronUp, Route, Milestone, MapPin,
} from "lucide-react";
import type { Timestamp } from "firebase/firestore";

interface TruckDoc { id: string; fleetId: string; brand: string; model: string; status: string; currentKm: string; imageBase64?: string; registrationExpiry?: string; insuranceExpiry?: string; inspectionExpiry?: string; lastOilChangeMiles?: string; oilChangeInterval?: string; createdAt: Timestamp; }
interface MaintDoc { 
  id: string; 
  truckId: string; 
  fleetId: string; 
  title: string; 
  type?: string; 
  maintenanceType?: string; 
  status: string; 
  cost: any; 
  partsCost?: any; 
  parts?: any[];
  scheduledDate?: string; 
  date?: any; 
  createdAt: Timestamp; 
}
interface FuelDoc { 
  id: string; 
  truckId: string; 
  truckName?: string;
  driver?: string;
  liters: string;         // Gallons
  totalCost: string;      // Cost
  efficiency: string;     // MPG
  fuelDate?: string;      // Date
  odometer?: string;      // Odometer reading
  miles?: string;         // Miles driven since last refuel
  createdAt: Timestamp; 
}
interface PartDoc { id: string; name: string; supplier: string; category: string; quantity: number; minStock: number; cost: number; imageBase64?: string; }
interface HistoryDoc { id: string; partId: string; partName: string; truck: string; quantity: number; totalCost: number; reason: string; date: string; createdAt: Timestamp; }

function safeNum(value: any): number { 
  if (value === undefined || value === null || value === '') return 0; 
  if (typeof value === 'object' && value !== null) {
    if (value._value !== undefined) return Number(value._value) || 0;
    if (value.value !== undefined) return Number(value.value) || 0;
  }
  const n = Number(value); 
  return isNaN(n) ? 0 : n; 
}

function extractDateString(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
    return undefined;
  }
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  if (value.seconds) {
    const d = new Date(value.seconds * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return undefined;
}

function isInPeriod(dateStr: string | undefined, period: string, selectedDate?: Date): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const recordYear = parseInt(parts[0], 10);
  const recordMonth = parseInt(parts[1], 10) - 1;
  const recordDay = parseInt(parts[2], 10);
  if (isNaN(recordYear) || isNaN(recordMonth) || isNaN(recordDay)) return false;
  const now = selectedDate || new Date();
  const selectedYear = now.getFullYear();
  const selectedMonth = now.getMonth();
  const selectedDay = now.getDate();
  if (period === "day") {
    return recordYear === selectedYear && recordMonth === selectedMonth && recordDay === selectedDay;
  }
  if (period === "month") {
    return recordYear === selectedYear && recordMonth === selectedMonth;
  }
  if (period === "year") {
    return recordYear === selectedYear;
  }
  return true;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${value.toFixed(0)}`;
}

function formatMiles(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${value.toFixed(0)}`;
}

// ===== TOAST =====
function Toast({ message, type, onClose }: { message: string; type: "success" | "warning" | "error" | "info"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.3)", icon: "#22c55e" }, warning: { bg: "rgba(234,179,8,0.15)", border: "rgba(234,179,8,0.3)", icon: "#eab308" }, error: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", icon: "#ef4444" }, info: { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)", icon: "#3b82f6" } };
  const icons = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Bell };
  const Icon = icons[type]; const c = colors[type];
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg" style={{ background: c.bg, border: `1px solid ${c.border}`, backdropFilter: "blur(10px)", minWidth: 300, animation: "fadeIn 0.3s ease-out" }}>
      <Icon size={20} style={{ color: c.icon }} />
      <p className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{message}</p>
      <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10"><X size={14} style={{ color: "var(--text-muted)" }} /></button>
    </div>
  );
}

// ===== DONUT CHART SEGMENT =====
function DonutSegment({ startAngle, endAngle, color, innerRadius, outerRadius }: { startAngle: number; endAngle: number; color: string; innerRadius: number; outerRadius: number }) {
  const start = polarToCartesian(100, 100, outerRadius, endAngle);
  const end = polarToCartesian(100, 100, outerRadius, startAngle);
  const startInner = polarToCartesian(100, 100, innerRadius, endAngle);
  const endInner = polarToCartesian(100, 100, innerRadius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  const path = [
    `M ${start.x} ${start.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
    `Z`
  ].join(" ");
  return <path d={path} fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1" />;
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ===== DONUT CHART =====
function DonutChart({ data, size = 280 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ transform: "rotate(-90deg)" }}>
      {total === 0 ? (
        <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="40" />
      ) : (
        data.map((d, i) => {
          if (d.value === 0) return null;
          const angle = (d.value / total) * 360;
          const segment = <DonutSegment key={i} startAngle={currentAngle} endAngle={currentAngle + angle} color={d.color} innerRadius={60} outerRadius={90} />;
          currentAngle += angle;
          return segment;
        })
      )}
      <circle cx="100" cy="100" r="55" fill="var(--bg-panel-solid, #0f172a)" />
    </svg>
  );
}

// ===== BIG STAT CARD =====
function BigStatCard({ title, value, subtitle, icon: Icon, color, onClick }: any) {
  return (
    <div className="glass-card p-6 flex items-center gap-5 cursor-pointer hover:scale-[1.02] transition-transform" onClick={onClick} style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-center justify-center rounded-2xl flex-shrink-0" style={{ width: 64, height: 64, background: `${color}15` }}>
        <Icon size={32} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: "var(--text-muted)" }}>{title}</p>
        <p className="text-3xl lg:text-4xl font-bold mono-font" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ===== PERIOD SELECTOR =====
function PeriodSelector({ period, setPeriod, selectedDate, setSelectedDate }: any) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const periods = [
    { id: "day", label: "Day" },
    { id: "month", label: "Month" },
    { id: "year", label: "Year" },
    { id: "all", label: "All" },
  ];
  const formatDateInput = (date: Date) => date.toISOString().split('T')[0];
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) setSelectedDate(new Date(e.target.value));
  };
  const navigateDate = (direction: number) => {
    const newDate = new Date(selectedDate);
    if (period === "day") newDate.setDate(newDate.getDate() + direction);
    else if (period === "month") newDate.setMonth(newDate.getMonth() + direction);
    else if (period === "year") newDate.setFullYear(newDate.getFullYear() + direction);
    setSelectedDate(newDate);
  };
  const getDateLabel = () => {
    if (period === "day") return selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    if (period === "month") return selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (period === "year") return selectedDate.getFullYear().toString();
    return "All Time";
  };
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
        {periods.map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)} className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{ background: period === p.id ? "rgba(232,168,56,0.2)" : "transparent", color: period === p.id ? "var(--accent-amber)" : "var(--text-muted)" }}>
            {p.label}
          </button>
        ))}
      </div>
      {period !== "all" && (
        <div className="flex items-center gap-2 relative">
          <button onClick={() => navigateDate(-1)} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}><ChevronLeft size={16} /></button>
          <button onClick={() => setShowDatePicker(!showDatePicker)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Calendar size={14} style={{ color: "var(--accent-amber)" }} />{getDateLabel()}<ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
          </button>
          <button onClick={() => navigateDate(1)} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}><ChevronRight size={16} /></button>
          {showDatePicker && (
            <div className="absolute top-full left-0 mt-2 p-3 rounded-xl z-50 shadow-xl" style={{ background: "var(--bg-panel-solid)", border: "1px solid rgba(255,255,255,0.2)", minWidth: 200 }}>
              <input type={period === "day" ? "date" : period === "month" ? "month" : "number"}
                value={period === "year" ? selectedDate.getFullYear() : period === "month" ? formatDateInput(selectedDate).slice(0, 7) : formatDateInput(selectedDate)}
                onChange={handleDateChange} min={period === "year" ? "2000" : undefined} max={period === "year" ? "2030" : undefined}
                className="px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: trucks } = useCollection<TruckDoc>("trucks");
  const { data: maintenance } = useCollection<MaintDoc>("maintenance");
  const { data: fuelRecords } = useCollection<FuelDoc>("fuelRecords");
  const { data: parts } = useCollection<PartDoc>("parts");
  const { data: history } = useCollection<HistoryDoc>("partsHistory");

  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "warning" | "error" | "info" }>>([]);
  const [period, setPeriod] = useState<"day" | "month" | "year" | "all">("month");
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const addToast = (message: string, type: "success" | "warning" | "error" | "info") => { const id = Date.now(); setToasts(prev => [...prev, { id, message, type }]); };
  const removeToast = (id: number) => { setToasts(prev => prev.filter(t => t.id !== id)); };

  // ===== FILTER DATA BY PERIOD =====
  const filteredFuel = useMemo(() => {
    if (period === "all") return fuelRecords;
    return fuelRecords.filter(f => {
      const dateStr = extractDateString(f.fuelDate) || extractDateString(f.createdAt);
      return isInPeriod(dateStr, period, selectedDate);
    });
  }, [fuelRecords, period, selectedDate]);

  const filteredMaint = useMemo(() => {
    if (period === "all") return maintenance;
    return maintenance.filter(m => {
      const dateStr = extractDateString(m.date) || extractDateString(m.scheduledDate) || extractDateString(m.createdAt);
      return isInPeriod(dateStr, period, selectedDate);
    });
  }, [maintenance, period, selectedDate]);

  const filteredHistory = useMemo(() => {
    if (period === "all") return history;
    return history.filter(h => {
      const dateStr = extractDateString(h.date) || extractDateString(h.createdAt);
      return isInPeriod(dateStr, period, selectedDate);
    });
  }, [history, period, selectedDate]);

  // ===== MILES CALCULATION - FROM FUEL RECORDS =====
  // ALL: sum of ALL fuel records miles (like Fuel page shows 13,187 mi)
  // Period: sum of filtered fuel records miles
  const periodMiles = useMemo(() => {
    return filteredFuel.reduce((sum, f) => {
      // Use the 'miles' field directly from fuel record (336 mi, 333 mi, 512 mi, etc.)
      const miles = safeNum(f.miles);
      if (miles > 0) return sum + miles;
      // Fallback: calculate from liters * efficiency if miles field is empty
      const liters = safeNum(f.liters);
      const efficiency = safeNum(f.efficiency);
      return sum + (liters * efficiency);
    }, 0);
  }, [filteredFuel]);

  // ===== CALCULATED STATS =====
  const totalFuelCost = filteredFuel.reduce((sum, f) => sum + (Number(f.totalCost) || 0), 0);
  const totalFuelLiters = filteredFuel.reduce((sum, f) => sum + (Number(f.liters) || 0), 0);
  const avgMPG = filteredFuel.length > 0 ? (filteredFuel.reduce((sum, f) => sum + (Number(f.efficiency) || 0), 0) / filteredFuel.length).toFixed(1) : "0.0";

  const totalMaintCost = filteredMaint.reduce((sum, m) => {
    const laborCost = safeNum(m.cost);
    const partsCostFromField = safeNum(m.partsCost);
    let partsCostFromArray = 0;
    if (m.parts && Array.isArray(m.parts)) {
      partsCostFromArray = m.parts.reduce((pSum: number, part: any) => {
        const partCost = safeNum(part.cost || part.unitCost || part.price);
        const partQty = safeNum(part.quantity || part.qty || 1);
        return pSum + (partCost * partQty);
      }, 0);
    }
    const totalPartsCost = Math.max(partsCostFromField, partsCostFromArray);
    return sum + laborCost + totalPartsCost;
  }, 0);

  const totalPartsHistoryCost = filteredHistory.reduce((sum, h) => sum + (Number(h.totalCost) || 0), 0);
  const totalFleetCost = totalFuelCost + totalMaintCost + totalPartsHistoryCost;

  const activeTrucks = trucks.filter(t => t.status === "active").length;
  const totalTrucks = trucks.length;

  // ===== DOCUMENT & OIL ALERTS =====
  const alerts = useMemo(() => {
    const list: Array<{ fleetId: string; label: string; detail: string; severity: "expired" | "warning" }> = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const docTypes: Array<{ key: "registrationExpiry" | "insuranceExpiry" | "inspectionExpiry"; label: string }> = [
      { key: "registrationExpiry", label: "Registration" },
      { key: "insuranceExpiry", label: "Insurance" },
      { key: "inspectionExpiry", label: "DOT Inspection" },
    ];
    trucks.forEach(t => {
      if (t.status === "sold") return;
      docTypes.forEach(d => {
        const val = t[d.key];
        if (!val) return;
        const exp = new Date(val + "T00:00:00");
        if (isNaN(exp.getTime())) return;
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
        if (daysLeft < 0) {
          list.push({ fleetId: t.fleetId, label: d.label, detail: "expired " + Math.abs(daysLeft) + " days ago (" + exp.toLocaleDateString("en-US") + ")", severity: "expired" });
        } else if (daysLeft <= 30) {
          list.push({ fleetId: t.fleetId, label: d.label, detail: "expires in " + daysLeft + " days (" + exp.toLocaleDateString("en-US") + ")", severity: "warning" });
        }
      });
      const lastOil = Number(t.lastOilChangeMiles) || 0;
      const interval = Number(t.oilChangeInterval) || 0;
      const current = Number(t.currentKm) || 0;
      if (lastOil > 0 && interval > 0) {
        const remaining = lastOil + interval - current;
        if (remaining <= 0) {
          list.push({ fleetId: t.fleetId, label: "Oil Change", detail: "overdue by " + Math.abs(remaining).toLocaleString() + " mi", severity: "expired" });
        } else if (remaining <= 1000) {
          list.push({ fleetId: t.fleetId, label: "Oil Change", detail: remaining.toLocaleString() + " mi remaining", severity: "warning" });
        }
      }
    });
    const order = { expired: 0, warning: 1 };
    return list.sort((a, b) => order[a.severity] - order[b.severity] || a.fleetId.localeCompare(b.fleetId, undefined, { numeric: true }));
  }, [trucks]);

  const oilStatus = useMemo(() => {
    return trucks
      .filter(t => t.status !== "sold" && Number(t.lastOilChangeMiles) > 0 && Number(t.oilChangeInterval) > 0)
      .map(t => {
        const lastOil = Number(t.lastOilChangeMiles) || 0;
        const interval = Number(t.oilChangeInterval) || 0;
        const current = Number(t.currentKm) || 0;
        const remaining = lastOil + interval - current;
        const pct = Math.max(0, Math.min(100, (remaining / interval) * 100));
        return { truckId: t.id, fleetId: t.fleetId, brand: t.brand, model: t.model, remaining, pct, lastOil, interval };
      })
      .sort((a, b) => a.remaining - b.remaining);
  }, [trucks]);

  // Miles is now ALWAYS from fuel records, regardless of period
  const displayMiles = periodMiles;
  const milesLabel = period === "all" ? "Total Miles" : "Miles Driven";
  const milesSubtitle = period === "all" 
    ? `${fuelRecords.length} refuels • ${avgMPG} MPG avg` 
    : `${filteredFuel.length} refuels • ${avgMPG} MPG avg`;

  // Donut chart data
  const donutData = [
    { label: "Fuel", value: totalFuelCost, color: "#22c55e" },
    { label: "Maintenance", value: totalMaintCost, color: "#f97316" },
    { label: "Parts", value: totalPartsHistoryCost, color: "#eab308" },
  ].filter(d => d.value > 0);

  const periodLabel = period === "day" ? "Today" : period === "month" ? "This Month" : period === "year" ? "This Year" : "All Time";

  // ===== PDF EXPORT =====
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { addToast("Please allow popups to export PDF", "warning"); return; }
    const reportDate = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const html = `
      <!DOCTYPE html><html><head><title>FleetPulse Report - ${periodLabel}</title>
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8f9fa; color: #333; padding: 30px; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #e8a838; }
        .header h1 { font-size: 32px; color: #1a1a2e; margin-bottom: 5px; }
        .header p { color: #666; font-size: 14px; }
        .period-badge { display: inline-block; background: #e8a838; color: #1a1a2e; padding: 6px 20px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-top: 10px; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: white; border-radius: 16px; padding: 25px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); border-left: 5px solid; }
        .stat-card.fuel { border-left-color: #22c55e; }
        .stat-card.maint { border-left-color: #f97316; }
        .stat-card.miles { border-left-color: #3b82f6; }
        .stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; }
        .stat-value { font-size: 36px; font-weight: bold; color: #1a1a2e; margin-bottom: 5px; }
        .stat-sub { font-size: 13px; color: #666; }
        .summary { background: white; border-radius: 16px; padding: 25px; margin-bottom: 30px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .summary h2 { font-size: 18px; color: #1a1a2e; margin-bottom: 20px; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
        .summary-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
        .summary-item:last-child { border-bottom: none; }
        .summary-label { font-size: 14px; color: #666; }
        .summary-value { font-size: 16px; font-weight: bold; color: #1a1a2e; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
        .footer .company { color: #e8a838; font-weight: bold; font-size: 14px; margin-top: 5px; }
      </style></head><body>
      <div class="header"><h1>🚛 FleetPulse Report</h1><p>${reportDate}</p><span class="period-badge">${periodLabel}</span></div>
      <div class="stats-grid">
        <div class="stat-card fuel"><div class="stat-label">Fuel Cost</div><div class="stat-value">$${totalFuelCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div><div class="stat-sub">${totalFuelLiters.toFixed(1)} gallons • ${avgMPG} MPG avg</div></div>
        <div class="stat-card maint"><div class="stat-label">Maintenance Cost</div><div class="stat-value">$${totalMaintCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div><div class="stat-sub">${filteredMaint.length} maintenance records</div></div>
        <div class="stat-card miles"><div class="stat-label">${milesLabel}</div><div class="stat-value">${displayMiles.toLocaleString()}</div><div class="stat-sub">${milesSubtitle}</div></div>
      </div>
      <div class="summary"><h2>📊 Cost Breakdown</h2>
        <div class="summary-grid">
          <div class="summary-item"><span class="summary-label">Fuel Cost</span><span class="summary-value" style="color: #22c55e;">$${totalFuelCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
          <div class="summary-item"><span class="summary-label">Maintenance Cost</span><span class="summary-value" style="color: #f97316;">$${totalMaintCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
          <div class="summary-item"><span class="summary-label">Parts Usage Cost</span><span class="summary-value" style="color: #eab308;">$${totalPartsHistoryCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
          <div class="summary-item"><span class="summary-label" style="font-weight: bold;">Total Fleet Cost</span><span class="summary-value" style="color: #e8a838; font-size: 20px;">$${totalFleetCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
        </div>
      </div>
      <div class="footer"><p>Generated by FleetPulse</p><p class="company">Drag n' Drop Dumpster Services</p></div>
      <script>window.onload = function() { window.print(); };</script>
      </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    addToast("Report opened! Click Print → Save as PDF", "success");
  };

  return (
    <div className="space-y-6">
      {toasts.map(toast => <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />)}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Fleet Dashboard</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }} className="uppercase tracking-wider">Operations Overview</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector period={period} setPeriod={setPeriod} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:scale-105"
            style={{ background: "rgba(232,168,56,0.15)", color: "var(--accent-amber)", border: "1px solid rgba(232,168,56,0.3)" }}>
            <Printer size={16} /> Export
          </button>
        </div>
      </div>

      {/* Big Stats Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BigStatCard title="Fuel Cost" value={formatCurrency(totalFuelCost)} 
          subtitle={`${totalFuelLiters.toFixed(1)} gal • ${avgMPG} MPG avg • ${filteredFuel.length} refuels`}
          icon={Droplets} color="#22c55e" onClick={() => addToast(`Fuel: ${formatCurrency(totalFuelCost)}`, "info")} />
        <BigStatCard title="Maintenance Cost" value={formatCurrency(totalMaintCost)} 
          subtitle={`${filteredMaint.length} records • ${filteredMaint.filter(m => m.status === "pending").length} pending`}
          icon={Wrench} color="#f97316" onClick={() => addToast(`Maintenance: ${formatCurrency(totalMaintCost)}`, "info")} />
        <BigStatCard title={milesLabel} value={formatMiles(displayMiles)} 
          subtitle={milesSubtitle}
          icon={MapPin} color="#3b82f6" onClick={() => addToast(`${milesLabel}: ${displayMiles.toLocaleString()}`, "info")} />
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut Chart */}
        <div className="glass-card p-6 lg:p-8 flex flex-col items-center">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: "var(--text-muted)" }}>Cost Distribution</h3>
          <div className="relative">
            <DonutChart data={donutData} size={320} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total Cost</p>
              <p className="text-3xl font-bold mono-font mt-1" style={{ color: "var(--accent-amber)" }}>{formatCurrency(totalFleetCost)}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{periodLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {donutData.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{d.label}</span>
                <span className="text-xs font-bold mono-font" style={{ color: d.color }}>{formatCurrency(d.value)}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>({totalFleetCost > 0 ? ((d.value / totalFleetCost) * 100).toFixed(0) : 0}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: "var(--text-muted)" }}>Cost Breakdown</h3>
          <div className="space-y-4">
            {/* Fuel */}
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.1)" }}>
              <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 48, height: 48, background: "rgba(34,197,94,0.1)" }}>
                <Droplets size={24} style={{ color: "#22c55e" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Fuel</span>
                  <span className="text-lg font-bold mono-font" style={{ color: "#22c55e" }}>{formatCurrency(totalFuelCost)}</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${totalFleetCost > 0 ? (totalFuelCost / totalFleetCost) * 100 : 0}%`, background: "#22c55e" }} />
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{totalFuelLiters.toFixed(1)} gallons • {avgMPG} MPG avg</p>
              </div>
            </div>

            {/* Maintenance */}
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.1)" }}>
              <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 48, height: 48, background: "rgba(249,115,22,0.1)" }}>
                <Wrench size={24} style={{ color: "#f97316" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Maintenance</span>
                  <span className="text-lg font-bold mono-font" style={{ color: "#f97316" }}>{formatCurrency(totalMaintCost)}</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${totalFleetCost > 0 ? (totalMaintCost / totalFleetCost) * 100 : 0}%`, background: "#f97316" }} />
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{filteredMaint.length} records</p>
              </div>
            </div>

            {/* Miles - Shows miles from fuel records */}
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.1)" }}>
              <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 48, height: 48, background: "rgba(59,130,246,0.1)" }}>
                <Route size={24} style={{ color: "#3b82f6" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{milesLabel}</span>
                  <span className="text-lg font-bold mono-font" style={{ color: "#3b82f6" }}>{formatMiles(displayMiles)}</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: "100%", background: "#3b82f6" }} />
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {period === "all" 
                    ? `${fuelRecords.length} total refuels • ${avgMPG} MPG avg` 
                    : `${filteredFuel.length} refuels • ${avgMPG} MPG avg`}
                </p>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center gap-4 p-4 rounded-xl mt-2" style={{ background: "rgba(232,168,56,0.08)", border: "1px solid rgba(232,168,56,0.2)" }}>
              <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 48, height: 48, background: "rgba(232,168,56,0.15)" }}>
                <DollarSign size={24} style={{ color: "var(--accent-amber)" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Total Fleet Cost</span>
                  <span className="text-2xl font-bold mono-font" style={{ color: "var(--accent-amber)" }}>{formatCurrency(totalFleetCost)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document & Oil Alerts */}
      {alerts.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(239,68,68,0.12)" }}>
              <Bell size={20} style={{ color: "#ef4444" }} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>Attention Needed / Atencao</h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Documents & oil change / Documentos e troca de oleo</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map((a, i) => (
              <Link to="/trucks" key={i} className="flex items-center gap-3 p-3 rounded-xl transition-transform hover:scale-[1.01]" style={{ background: a.severity === "expired" ? "rgba(239,68,68,0.08)" : "rgba(232,168,56,0.08)", border: "1px solid " + (a.severity === "expired" ? "rgba(239,68,68,0.25)" : "rgba(232,168,56,0.25)") }}>
                {a.severity === "expired" ? <XCircle size={18} style={{ color: "#ef4444", flexShrink: 0 }} /> : <AlertTriangle size={18} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    <span className="mono-font font-bold" style={{ color: a.severity === "expired" ? "#ef4444" : "var(--accent-amber)" }}>#{a.fleetId}</span> — {a.label}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{a.detail}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Oil Change Status */}
      {oilStatus.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(59,130,246,0.12)" }}>
              <Gauge size={20} style={{ color: "#3b82f6" }} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>Oil Change / Troca de Oleo</h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Miles until next oil change / Milhas ate a proxima troca</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {oilStatus.map(o => (
              <div key={o.truckId} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-divider)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}><span className="mono-font font-bold" style={{ color: "var(--accent-amber)" }}>#{o.fleetId}</span> {o.brand} {o.model}</span>
                  <span className="text-sm font-bold mono-font" style={{ color: o.remaining <= 0 ? "#ef4444" : o.remaining <= 1000 ? "var(--accent-amber)" : "#22c55e" }}>
                    {o.remaining <= 0 ? Math.abs(o.remaining).toLocaleString() + " mi overdue" : o.remaining.toLocaleString() + " mi left"}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: o.pct + "%", background: o.remaining <= 0 ? "#ef4444" : o.remaining <= 1000 ? "var(--accent-amber)" : "#22c55e" }} />
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Last change: {o.lastOil.toLocaleString()} mi • Every {o.interval.toLocaleString()} mi</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
