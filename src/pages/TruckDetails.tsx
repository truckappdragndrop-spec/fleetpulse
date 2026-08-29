import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useCollection } from "@/hooks/useCollection";
import {
  ArrowLeft,
  Truck,
  Wrench,
  Droplets,
  DollarSign,
  Gauge,
  AlertTriangle,
  FileText,
  Package,
} from "lucide-react";
import type { Timestamp } from "firebase/firestore";

interface TruckDoc {
  id: string;
  fleetId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  currentKm: string;
  fuelTankCapacity?: number;
  status: "active" | "maintenance" | "inactive" | "sold";
  notes?: string;
  vin?: string;
  engine?: string;
  createdAt: Timestamp;
}

interface MaintDoc {
  id: string;
  truckId: string;
  truckName?: string;
  title?: string;
  type?: string;
  maintenanceType?: string;
  status: string;
  priority?: string;
  cost: any;
  partsCost?: any;
  partIds?: string[];  // Array of part IDs (strings)
  parts?: any[];        // Fallback: array of part objects
  scheduledDate?: string;
  date?: any;
  completedDate?: string;
  description?: string;
  createdAt?: Timestamp;
}

interface FuelDoc {
  id: string;
  truckId: string;
  liters: string;
  totalCost: string;
  efficiency: string;
  odometer: string;
  station?: string;
  createdAt: Timestamp;
}

interface PartDoc {
  id: string;
  name: string;
  partNumber?: string;
  quantity: number;
  cost: number;
  category: string;
  supplier: string;
  minQuantity?: number;
  truckId?: string;
  status: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: `${color}15` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
      <p className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function safeFormatDate(dateValue: any): string {
  if (!dateValue) return "N/A";
  try {
    if (typeof dateValue === "string") return dateValue;
    if (dateValue instanceof Date) return dateValue.toISOString().split("T")[0];
    if (dateValue.toDate) return dateValue.toDate().toISOString().split("T")[0];
    if (dateValue.seconds) return new Date(dateValue.seconds * 1000).toISOString().split("T")[0];
    return "N/A";
  } catch {
    return "N/A";
  }
}

function safeGetCost(value: any): number {
  if (value === undefined || value === null) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

function safeNum(value: any): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'object' && value !== null) {
    if (value._value !== undefined) return Number(value._value) || 0;
    if (value.value !== undefined) return Number(value.value) || 0;
  }
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

export default function TruckDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "maintenance" | "fuel" | "parts">("overview");

  const { data: trucks } = useCollection<TruckDoc>("trucks");
  const { data: maintenance } = useCollection<MaintDoc>("maintenance");
  const { data: fuelRecords } = useCollection<FuelDoc>("fuelRecords");
  const { data: allParts } = useCollection<PartDoc>("parts");

  const truck = trucks.find((t) => t.id === id);

  const truckMaintenance = maintenance
    .filter((m) => m.truckId === id)
    .sort((a, b) => {
      const dateA = safeFormatDate(a.date || a.scheduledDate);
      const dateB = safeFormatDate(b.date || b.scheduledDate);
      return dateB.localeCompare(dateA);
    });

  const truckFuel = fuelRecords
    .filter((f) => f.truckId === id)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

  // Extract parts from maintenance records using partIds
  const maintenanceParts = useMemo(() => {
    const parts: Array<{
      maintId: string;
      maintTitle: string;
      maintDate: string;
      partName: string;
      partNumber?: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
    }> = [];

    truckMaintenance.forEach((m) => {
      // Try partIds first (array of strings from Maintenance.tsx)
      if (m.partIds && Array.isArray(m.partIds) && m.partIds.length > 0 && allParts) {
        m.partIds.forEach((partId: string) => {
          const part = allParts.find((p) => p.id === partId);
          if (part) {
            parts.push({
              maintId: m.id,
              maintTitle: m.title || "Maintenance",
              maintDate: safeFormatDate(m.date || m.scheduledDate),
              partName: part.name || "Unknown Part",
              partNumber: part.partNumber,
              quantity: 1, // Default quantity since partIds only stores IDs
              unitCost: safeNum(part.cost),
              totalCost: safeNum(part.cost),
            });
          }
        });
      }
      // Fallback: try parts array (array of objects)
      else if (m.parts && Array.isArray(m.parts)) {
        m.parts.forEach((part: any) => {
          const qty = safeNum(part.quantity || part.qty || 1);
          const cost = safeNum(part.cost || part.unitCost || part.price || 0);
          parts.push({
            maintId: m.id,
            maintTitle: m.title || "Maintenance",
            maintDate: safeFormatDate(m.date || m.scheduledDate),
            partName: part.name || part.partName || "Unknown Part",
            partNumber: part.partNumber,
            quantity: qty,
            unitCost: cost,
            totalCost: cost * qty,
          });
        });
      }
    });

    return parts;
  }, [truckMaintenance, allParts]);

  const totalMaintCost = truckMaintenance.reduce(
    (sum, m) => sum + safeGetCost(m.cost) + safeGetCost(m.partsCost),
    0
  );
  const totalFuelCost = truckFuel.reduce(
    (sum, f) => sum + (Number(f.totalCost) || 0),
    0
  );
  // Total cost only includes maintenance + fuel (parts cost is already in maintenance.partsCost)
  const totalCost = totalMaintCost + totalFuelCost;

  const avgMPG =
    truckFuel.length > 0
      ? (
          truckFuel.reduce((sum, f) => sum + (Number(f.efficiency) || 0), 0) /
          truckFuel.length
        ).toFixed(1)
      : "0.0";

  const lastFuel = truckFuel[0];
  const lastMaint = truckMaintenance[0];

  const getStatusColor = (s: string) =>
    ({
      active: "var(--accent-green)",
      maintenance: "var(--accent-orange)",
      inactive: "var(--text-muted)",
      sold: "var(--text-secondary)",
      completed: "var(--accent-green)",
      pending: "var(--accent-amber)",
      overdue: "var(--accent-red)",
    }[s] || "var(--text-muted)");

  const getStatusLabel = (s: string) =>
    ({
      active: "Active",
      maintenance: "In Maintenance",
      inactive: "Inactive",
      sold: "Sold",
      completed: "Completed",
      pending: "Pending",
      overdue: "Overdue",
    }[s] || s);

  if (!truck) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Truck size={48} className="opacity-30 mb-4" />
        <p style={{ color: "var(--text-muted)" }}>Truck not found</p>
        <button onClick={() => navigate("/trucks")} className="btn-primary mt-4 flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Fleet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate("/trucks")} className="flex items-center gap-1 text-sm mb-3" style={{ color: "var(--accent-amber)" }}>
            <ArrowLeft size={16} /> Back to Fleet
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {truck.fleetId}
            </h1>
            <span className="text-xs px-2 py-1 rounded-md" style={{ background: `${getStatusColor(truck.status)}15`, color: getStatusColor(truck.status) }}>
              {getStatusLabel(truck.status)}
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            {truck.brand} {truck.model} &bull; {truck.year}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Gauge} label="Current Miles" value={`${Number(truck.currentKm).toLocaleString("en-US")} mi`} color="var(--accent-amber)" />
        <StatCard icon={DollarSign} label="Total Costs" value={`$${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} color="var(--accent-orange)" />
        <StatCard icon={Droplets} label="Avg Fuel Effic." value={`${avgMPG} MPG`} color="var(--accent-green)" />
        <StatCard icon={Wrench} label="Maintenance Records" value={String(truckMaintenance.length)} color="var(--accent-amber)" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
        {[
          { key: "overview", label: "Overview", icon: FileText },
          { key: "maintenance", label: "Maintenance", icon: Wrench },
          { key: "fuel", label: "Fuel", icon: Droplets },
          { key: "parts", label: "Parts Used", icon: Package },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: activeTab === tab.key ? "rgba(232,168,56,0.15)" : "transparent", color: activeTab === tab.key ? "var(--accent-amber)" : "var(--text-muted)" }}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-5">
            <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Vehicle Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <span style={{ color: "var(--text-muted)" }}>License Plate</span>
                <span className="mono-font" style={{ color: "var(--text-primary)" }}>{truck.plate}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <span style={{ color: "var(--text-muted)" }}>VIN / Chassis</span>
                <span className="mono-font text-sm" style={{ color: "var(--text-primary)" }}>{truck.vin || "Not registered"}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <span style={{ color: "var(--text-muted)" }}>Engine</span>
                <span style={{ color: "var(--text-primary)" }}>{truck.engine || "Not registered"}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <span style={{ color: "var(--text-muted)" }}>Color</span>
                <span style={{ color: "var(--text-primary)" }}>{truck.color || "Not registered"}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <span style={{ color: "var(--text-muted)" }}>Fuel Tank</span>
                <span style={{ color: "var(--text-primary)" }}>{truck.fuelTankCapacity ? `${truck.fuelTankCapacity} gal` : "Not registered"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span style={{ color: "var(--text-muted)" }}>Registered</span>
                <span style={{ color: "var(--text-primary)" }}>{truck.createdAt?.toDate().toLocaleDateString("en-US") || "N/A"}</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Recent Activity</h2>
            <div className="space-y-3">
              {lastFuel && (
                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(74,155,106,0.06)" }}>
                  <Droplets size={18} style={{ color: "var(--accent-green)", marginTop: 2 }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Last Fuel Record</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{Number(lastFuel.liters).toFixed(1)} gal &bull; ${Number(lastFuel.totalCost).toFixed(2)} &bull; {lastFuel.efficiency} MPG</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Odometer: {Number(lastFuel.odometer).toLocaleString("en-US")} mi</p>
                  </div>
                </div>
              )}
              {lastMaint && (
                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(196,120,42,0.06)" }}>
                  <Wrench size={18} style={{ color: "var(--accent-orange)", marginTop: 2 }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Last Maintenance</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{lastMaint.title} &bull; {lastMaint.type || lastMaint.maintenanceType}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Cost: ${(safeGetCost(lastMaint.cost) + safeGetCost(lastMaint.partsCost)).toFixed(2)} &bull; Status: {getStatusLabel(lastMaint.status)}</p>
                  </div>
                </div>
              )}
              {!lastFuel && !lastMaint && (
                <p className="text-center py-8" style={{ color: "var(--text-muted)" }}>No activity recorded yet</p>
              )}
            </div>
          </div>

          {truck.notes && (
            <div className="glass-card p-5 lg:col-span-2">
              <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Notes</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{truck.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Maintenance Tab */}
      {activeTab === "maintenance" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Maintenance History</h2>
            <Link to="/maintenance" className="text-sm flex items-center gap-1" style={{ color: "var(--accent-amber)" }}>View All <ArrowLeft size={14} className="rotate-180" /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Service</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Type</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Cost</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {truckMaintenance.length > 0 ? (
                  truckMaintenance.map((m) => (
                    <tr key={m.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>{safeFormatDate(m.date || m.scheduledDate)}</td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{m.title}</p>
                        {m.description && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.description}</p>}
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>{m.type || m.maintenanceType}</td>
                      <td className="px-5 py-4 text-sm mono-font" style={{ color: "var(--text-primary)" }}>${(safeGetCost(m.cost) + safeGetCost(m.partsCost)).toFixed(2)}</td>
                      <td className="px-5 py-4">
                        <span className="text-xs px-2 py-1 rounded-md" style={{ background: `${getStatusColor(m.status)}15`, color: getStatusColor(m.status) }}>
                          {getStatusLabel(m.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12" style={{ color: "var(--text-muted)" }}>
                      <Wrench size={48} className="mx-auto mb-3 opacity-30" />
                      <p>No maintenance records</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fuel Tab */}
      {activeTab === "fuel" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Fuel Records</h2>
            <Link to="/fuel" className="text-sm flex items-center gap-1" style={{ color: "var(--accent-amber)" }}>View All <ArrowLeft size={14} className="rotate-180" /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Gallons</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Cost</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Efficiency</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Odometer</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Station</th>
                </tr>
              </thead>
              <tbody>
                {truckFuel.length > 0 ? (
                  truckFuel.map((f) => (
                    <tr key={f.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>{f.createdAt?.toDate().toLocaleDateString("en-US") || "N/A"}</td>
                      <td className="px-5 py-4 text-sm mono-font" style={{ color: "var(--text-primary)" }}>{Number(f.liters).toFixed(1)} gal</td>
                      <td className="px-5 py-4 text-sm mono-font" style={{ color: "var(--text-primary)" }}>${Number(f.totalCost).toFixed(2)}</td>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--accent-green)" }}>{f.efficiency} MPG</td>
                      <td className="px-5 py-4 text-sm mono-font" style={{ color: "var(--text-secondary)" }}>{Number(f.odometer).toLocaleString("en-US")} mi</td>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-muted)" }}>{f.station || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12" style={{ color: "var(--text-muted)" }}>
                      <Droplets size={48} className="mx-auto mb-3 opacity-30" />
                      <p>No fuel records</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Parts Tab - Shows parts from maintenance records using partIds */}
      {activeTab === "parts" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Parts Used in Maintenance</h2>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              {maintenanceParts.length} part{maintenanceParts.length !== 1 ? 's' : ''} used
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Maintenance</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Part</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Qty</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Unit Cost</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceParts.length > 0 ? (
                  maintenanceParts.map((part, idx) => (
                    <tr key={idx} className="table-row-hover" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>{part.maintDate}</td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{part.maintTitle}</p>
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-primary)" }}>
                        {part.partName}
                        {part.partNumber && <span className="text-xs block" style={{ color: "var(--text-muted)" }}>#{part.partNumber}</span>}
                      </td>
                      <td className="px-5 py-4 text-sm mono-font" style={{ color: "var(--text-primary)" }}>{part.quantity}</td>
                      <td className="px-5 py-4 text-sm mono-font" style={{ color: "var(--text-muted)" }}>${part.unitCost.toFixed(2)}</td>
                      <td className="px-5 py-4 text-sm mono-font" style={{ color: "var(--accent-green)" }}>${part.totalCost.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12" style={{ color: "var(--text-muted)" }}>
                      <Package size={48} className="mx-auto mb-3 opacity-30" />
                      <p>No parts used in maintenance</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 text-xs text-center" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-divider)" }}>
            Parts costs are included in the maintenance total cost. Not counted separately to avoid double counting.
          </div>
        </div>
      )}
    </div>
  );
}
