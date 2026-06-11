import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useCollection } from "@/hooks/useCollection";
import {
  ArrowLeft,
  Truck,
  Wrench,
  Droplets,
  ClipboardCheck,
  DollarSign,
  Gauge,
  AlertTriangle,
  FileText,
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
  fleetId: string;
  title: string;
  maintenanceType: string;
  status: string;
  priority: string;
  cost: string;
  scheduledDate: string;
  completedDate?: string;
  description?: string;
  createdAt: Timestamp;
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

interface ChecklistDoc {
  id: string;
  truckId: string;
  fleetId: string;
  driverName: string;
  shift: string;
  status: string;
  issuesFound: boolean;
  checklistDate: string;
  notes?: string;
  createdAt: Timestamp;
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
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ width: 36, height: 36, background: `${color}15` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
      </div>
      <p
        className="text-xl font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

export default function TruckDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "overview" | "maintenance" | "fuel" | "checklists"
  >("overview");

  const { data: trucks } = useCollection<TruckDoc>("trucks");
  const { data: maintenance } = useCollection<MaintDoc>("maintenance");
  const { data: fuelRecords } = useCollection<FuelDoc>("fuelRecords");
  const { data: checklists } = useCollection<ChecklistDoc>("driverChecklists");

  const truck = trucks.find((t) => t.id === id);

  const truckMaintenance = maintenance
    .filter((m) => m.truckId === id)
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));

  const truckFuel = fuelRecords
    .filter((f) => f.truckId === id)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

  const truckChecklists = checklists
    .filter((c) => c.truckId === id)
    .sort((a, b) => b.checklistDate.localeCompare(a.checklistDate));

  const totalMaintCost = truckMaintenance.reduce(
    (sum, m) => sum + (Number(m.cost) || 0),
    0
  );
  const totalFuelCost = truckFuel.reduce(
    (sum, f) => sum + (Number(f.totalCost) || 0),
    0
  );
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
  const lastChecklist = truckChecklists[0];

  const getStatusColor = (s: string) =>
    ({
      active: "var(--accent-green)",
      maintenance: "var(--accent-orange)",
      inactive: "var(--text-muted)",
      sold: "var(--text-secondary)",
      completed: "var(--accent-green)",
      pending: "var(--accent-amber)",
      overdue: "var(--accent-red)",
      issues_reported: "var(--accent-red)",
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
      issues_reported: "Issues",
    }[s] || s);

  if (!truck) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Truck size={48} className="opacity-30 mb-4" />
        <p style={{ color: "var(--text-muted)" }}>Truck not found</p>
        <button
          onClick={() => navigate("/trucks")}
          className="btn-primary mt-4 flex items-center gap-2"
        >
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
          <button
            onClick={() => navigate("/trucks")}
            className="flex items-center gap-1 text-sm mb-3"
            style={{ color: "var(--accent-amber)" }}
          >
            <ArrowLeft size={16} /> Back to Fleet
          </button>
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl lg:text-3xl font-semibold"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            >
              {truck.fleetId}
            </h1>
            <span
              className="text-xs px-2 py-1 rounded-md"
              style={{
                background: `${getStatusColor(truck.status)}15`,
                color: getStatusColor(truck.status),
              }}
            >
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
        <StatCard
          icon={Gauge}
          label="Current Miles"
          value={`${Number(truck.currentKm).toLocaleString("en-US")} mi`}
          color="var(--accent-amber)"
        />
        <StatCard
          icon={DollarSign}
          label="Total Costs"
          value={`$${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          color="var(--accent-orange)"
        />
        <StatCard
          icon={Droplets}
          label="Avg Fuel Effic."
          value={`${avgMPG} MPG`}
          color="var(--accent-green)"
        />
        <StatCard
          icon={Wrench}
          label="Maintenance Records"
          value={String(truckMaintenance.length)}
          color="var(--accent-amber)"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
        {[
          { key: "overview", label: "Overview", icon: FileText },
          { key: "maintenance", label: "Maintenance", icon: Wrench },
          { key: "fuel", label: "Fuel", icon: Droplets },
          { key: "checklists", label: "Checklists", icon: ClipboardCheck },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeTab === tab.key ? "rgba(232,168,56,0.15)" : "transparent",
              color: activeTab === tab.key ? "var(--accent-amber)" : "var(--text-muted)",
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Vehicle Info */}
          <div className="glass-card p-5">
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              Vehicle Information
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <span style={{ color: "var(--text-muted)" }}>License Plate</span>
                <span className="mono-font" style={{ color: "var(--text-primary)" }}>
                  {truck.plate}
                </span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <span style={{ color: "var(--text-muted)" }}>VIN / Chassis</span>
                <span className="mono-font text-sm" style={{ color: "var(--text-primary)" }}>
                  {truck.vin || "Not registered"}
                </span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <span style={{ color: "var(--text-muted)" }}>Engine</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {truck.engine || "Not registered"}
                </span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <span style={{ color: "var(--text-muted)" }}>Color</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {truck.color || "Not registered"}
                </span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <span style={{ color: "var(--text-muted)" }}>Fuel Tank</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {truck.fuelTankCapacity ? `${truck.fuelTankCapacity} gal` : "Not registered"}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span style={{ color: "var(--text-muted)" }}>Registered</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {truck.createdAt?.toDate().toLocaleDateString("en-US") || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity Summary */}
          <div className="glass-card p-5">
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              Recent Activity
            </h2>
            <div className="space-y-3">
              {lastFuel && (
                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(74,155,106,0.06)" }}>
                  <Droplets size={18} style={{ color: "var(--accent-green)", marginTop: 2 }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      Last Fuel Record
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {Number(lastFuel.liters).toFixed(1)} gal &bull; ${Number(lastFuel.totalCost).toFixed(2)} &bull; {lastFuel.efficiency} MPG
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Odometer: {Number(lastFuel.odometer).toLocaleString("en-US")} mi
                    </p>
                  </div>
                </div>
              )}
              {lastMaint && (
                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(196,120,42,0.06)" }}>
                  <Wrench size={18} style={{ color: "var(--accent-orange)", marginTop: 2 }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      Last Maintenance
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {lastMaint.title} &bull; {lastMaint.maintenanceType}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Cost: ${Number(lastMaint.cost || 0).toFixed(2)} &bull; Status: {getStatusLabel(lastMaint.status)}
                    </p>
                  </div>
                </div>
              )}
              {lastChecklist && (
                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(232,168,56,0.06)" }}>
                  <ClipboardCheck size={18} style={{ color: "var(--accent-amber)", marginTop: 2 }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      Last Checklist
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {lastChecklist.driverName} &bull; {lastChecklist.shift} shift
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Date: {lastChecklist.checklistDate} &bull; {lastChecklist.issuesFound ? "Issues found" : "No issues"}
                    </p>
                  </div>
                </div>
              )}
              {!lastFuel && !lastMaint && !lastChecklist && (
                <p className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                  No activity recorded yet
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          {truck.notes && (
            <div className="glass-card p-5 lg:col-span-2">
              <h2
                className="text-lg font-semibold mb-3"
                style={{ color: "var(--text-primary)" }}
              >
                Notes
              </h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {truck.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Maintenance Tab */}
      {activeTab === "maintenance" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Maintenance History
            </h2>
            <Link
              to="/maintenance"
              className="text-sm flex items-center gap-1"
              style={{ color: "var(--accent-amber)" }}
            >
              View All <ArrowLeft size={14} className="rotate-180" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Date
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Service
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Type
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Cost
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {truckMaintenance.length > 0 ? (
                  truckMaintenance.map((m) => (
                    <tr
                      key={m.id}
                      className="table-row-hover"
                      style={{ borderBottom: "1px solid var(--border-divider)" }}
                    >
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {m.scheduledDate}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {m.title}
                        </p>
                        {m.description && (
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {m.description}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {m.maintenanceType}
                      </td>
                      <td className="px-5 py-4 text-sm mono-font" style={{ color: "var(--text-primary)" }}>
                        ${Number(m.cost || 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="text-xs px-2 py-1 rounded-md"
                          style={{
                            background: `${getStatusColor(m.status)}15`,
                            color: getStatusColor(m.status),
                          }}
                        >
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
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Fuel Records
            </h2>
            <Link
              to="/fuel"
              className="text-sm flex items-center gap-1"
              style={{ color: "var(--accent-amber)" }}
            >
              View All <ArrowLeft size={14} className="rotate-180" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Date
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Gallons
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Cost
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Efficiency
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Odometer
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Station
                  </th>
                </tr>
              </thead>
              <tbody>
                {truckFuel.length > 0 ? (
                  truckFuel.map((f) => (
                    <tr
                      key={f.id}
                      className="table-row-hover"
                      style={{ borderBottom: "1px solid var(--border-divider)" }}
                    >
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {f.createdAt?.toDate().toLocaleDateString("en-US") || "N/A"}
                      </td>
                      <td className="px-5 py-4 text-sm mono-font" style={{ color: "var(--text-primary)" }}>
                        {Number(f.liters).toFixed(1)} gal
                      </td>
                      <td className="px-5 py-4 text-sm mono-font" style={{ color: "var(--text-primary)" }}>
                        ${Number(f.totalCost).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--accent-green)" }}>
                        {f.efficiency} MPG
                      </td>
                      <td className="px-5 py-4 text-sm mono-font" style={{ color: "var(--text-secondary)" }}>
                        {Number(f.odometer).toLocaleString("en-US")} mi
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-muted)" }}>
                        {f.station || "-"}
                      </td>
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

      {/* Checklists Tab */}
      {activeTab === "checklists" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Driver Checklists
            </h2>
            <Link
              to="/checklists"
              className="text-sm flex items-center gap-1"
              style={{ color: "var(--accent-amber)" }}
            >
              View All <ArrowLeft size={14} className="rotate-180" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Date
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Driver
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Shift
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Issues
                  </th>
                </tr>
              </thead>
              <tbody>
                {truckChecklists.length > 0 ? (
                  truckChecklists.map((c) => (
                    <tr
                      key={c.id}
                      className="table-row-hover"
                      style={{ borderBottom: "1px solid var(--border-divider)" }}
                    >
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {c.checklistDate}
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-primary)" }}>
                        {c.driverName}
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {c.shift === "morning"
                          ? "Morning"
                          : c.shift === "afternoon"
                            ? "Afternoon"
                            : "Night"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="text-xs px-2 py-1 rounded-md"
                          style={{
                            background: `${getStatusColor(c.status)}15`,
                            color: getStatusColor(c.status),
                          }}
                        >
                          {getStatusLabel(c.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {c.issuesFound ? (
                          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--accent-red)" }}>
                            <AlertTriangle size={14} /> Yes
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--accent-green)" }}>
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12" style={{ color: "var(--text-muted)" }}>
                      <ClipboardCheck size={48} className="mx-auto mb-3 opacity-30" />
                      <p>No checklists recorded</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
