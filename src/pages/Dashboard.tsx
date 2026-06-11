import { useCollection } from "@/hooks/useCollection";
import { Link } from "react-router";
import {
  Truck,
  Wrench,
  Droplets,
  Package,
  AlertTriangle,
  History,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import type { Timestamp } from "firebase/firestore";

interface TruckDoc {
  id: string;
  fleetId: string;
  brand: string;
  model: string;
  status: string;
  currentKm: string;
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
  scheduledDate: string;
  createdAt: Timestamp;
}

interface FuelDoc {
  id: string;
  truckId: string;
  liters: string;
  totalCost: string;
  efficiency: string;
  createdAt: Timestamp;
}

interface PartDoc {
  id: string;
  name: string;
  supplier: string;
  category: string;
  quantity: number;
  minStock: number;
  cost: number;
  partNumber?: string;
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

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="glass-card p-5 lg:p-6">
      <div className="flex items-start justify-between mb-4">
        <div
          className="flex items-center justify-center rounded-xl"
          style={{ width: 48, height: 48, background: `${color}15` }}
        >
          <Icon size={24} style={{ color }} />
        </div>
      </div>
      <p
        className="text-3xl lg:text-4xl font-semibold mb-1"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
      >
        {value}
      </p>
      <p className="text-sm mb-0.5" style={{ color: "var(--text-secondary)" }}>
        {title}
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{subtitle}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data: trucks } = useCollection<TruckDoc>("trucks");
  const { data: maintenance } = useCollection<MaintDoc>("maintenance");
  const { data: fuelRecords } = useCollection<FuelDoc>("fuelRecords");
  const { data: parts } = useCollection<PartDoc>("parts");
  const { data: history } = useCollection<HistoryDoc>("partsHistory");

  const today = new Date().toISOString().split("T")[0];

  const activeCount = trucks.filter((t) => t.status === "active").length;
  const pendingMaint = maintenance.filter((m) => m.status === "pending").length;
  const overdueMaint = maintenance.filter((m) => m.status === "overdue" || (m.status === "pending" && m.scheduledDate <= today)).length;

  const avgMPG =
    fuelRecords.length > 0
      ? (fuelRecords.reduce((sum, f) => sum + (Number(f.efficiency) || 0), 0) / fuelRecords.length).toFixed(1)
      : "0.0";

  // Parts stats
  const totalParts = parts.reduce((sum, p) => sum + p.quantity, 0);
  const totalPartsValue = parts.reduce((sum, p) => sum + p.quantity * p.cost, 0);
  const lowStockParts = parts.filter((p) => p.quantity > 0 && p.quantity <= p.minStock).length;
  const outOfStockParts = parts.filter((p) => p.quantity === 0).length;

  // Recent parts usage
  const recentPartsUsage = history
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Overdue maintenance list
  const overdueList = maintenance
    .filter((m) => m.status === "overdue" || (m.status === "pending" && m.scheduledDate <= today))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Dashboard
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Fleet overview at a glance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Fleet Size" 
          value={String(trucks.length)} 
          subtitle={`${activeCount} active`} 
          icon={Truck} 
          color="var(--text-primary)" 
        />
        <MetricCard 
          title="Maintenance" 
          value={String(pendingMaint)} 
          subtitle={`${overdueMaint} overdue`} 
          icon={Wrench} 
          color="var(--accent-orange)" 
        />
        <MetricCard 
          title="Avg Fuel Effic." 
          value={`${avgMPG} MPG`} 
          subtitle="Fleet average" 
          icon={Droplets} 
          color="var(--accent-green)" 
        />
        <MetricCard 
          title="Parts in Stock" 
          value={String(totalParts)} 
          subtitle={`${lowStockParts} low, ${outOfStockParts} out`} 
          icon={Package} 
          color="var(--accent-amber)" 
        />
      </div>

      {/* Two Column: Parts Usage + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Parts Usage */}
        <div className="glass-card p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <History size={18} style={{ color: "var(--accent-amber)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Recent Parts Usage</h2>
            </div>
            <Link to="/inventory" className="flex items-center gap-1 text-sm" style={{ color: "var(--accent-amber)" }}>
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {recentPartsUsage.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {recentPartsUsage.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center gap-3 p-3 rounded-xl" 
                  style={{ background: "rgba(255, 255, 255, 0.03)", borderBottom: "1px solid var(--border-divider)" }}
                >
                  <div 
                    className="flex items-center justify-center rounded-lg" 
                    style={{ width: 36, height: 36, background: "rgba(74, 155, 106, 0.1)" }}
                  >
                    <Package size={16} style={{ color: "var(--accent-green)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {item.partName}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {item.truck} — {item.reason || "No reason"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium mono-font" style={{ color: "var(--accent-amber)" }}>
                      {item.quantity} pcs
                    </p>
                    <p className="text-xs mono-font" style={{ color: "var(--text-muted)" }}>
                      ${item.totalCost.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package size={48} className="mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No parts usage yet</p>
              <Link 
                to="/inventory" 
                className="inline-block mt-2 text-sm" 
                style={{ color: "var(--accent-amber)" }}
              >
                Go to Parts Inventory →
              </Link>
            </div>
          )}
        </div>

        {/* Alerts / Overdue Maintenance */}
        <div className="glass-card p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} style={{ color: "var(--accent-red)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Alerts</h2>
            </div>
            <Link to="/maintenance" className="flex items-center gap-1 text-sm" style={{ color: "var(--accent-amber)" }}>
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {overdueList.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {overdueList.map((alert) => (
                <div 
                  key={alert.id} 
                  className="flex items-start gap-3 p-3 rounded-xl" 
                  style={{ background: "rgba(184, 64, 64, 0.06)", borderLeft: "3px solid var(--accent-red)" }}
                >
                  <AlertTriangle size={18} style={{ color: "var(--accent-red)", marginTop: 2 }} />
                  <div className="flex-1 min-w-0">
                    <span className="mono-font text-sm font-medium" style={{ color: "var(--accent-amber)" }}>
                      {alert.fleetId}
                    </span>
                    <p className="text-sm mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
                      {alert.title}
                    </p>
                    <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      Due: {alert.scheduledDate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div 
                className="flex items-center justify-center rounded-full mx-auto mb-3" 
                style={{ width: 48, height: 48, background: "rgba(74, 155, 106, 0.1)" }}
              >
                <Package size={24} style={{ color: "var(--accent-green)" }} />
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>No pending alerts</p>
            </div>
          )}
        </div>
      </div>

      {/* Parts Value + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Parts Inventory Value */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center justify-center rounded-xl" 
              style={{ width: 48, height: 48, background: "rgba(74, 155, 106, 0.08)" }}
            >
              <DollarSign size={24} style={{ color: "var(--accent-green)" }} />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                ${totalPartsValue.toLocaleString()}
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Inventory Value</p>
            </div>
          </div>
        </div>

        <Link to="/inventory" className="glass-card p-5 block">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center justify-center rounded-xl" 
              style={{ width: 48, height: 48, background: "rgba(232, 168, 56, 0.08)" }}
            >
              <Package size={24} style={{ color: "var(--accent-amber)" }} />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Parts Inventory</p>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{parts.length} parts registered</p>
            </div>
          </div>
        </Link>

        <Link to="/fuel" className="glass-card p-5 block">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center justify-center rounded-xl" 
              style={{ width: 48, height: 48, background: "rgba(74, 155, 106, 0.08)" }}
            >
              <Droplets size={24} style={{ color: "var(--accent-green)" }} />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Fuel Tracking</p>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Track diesel consumption</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Bottom Row: Fleet + Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Link to="/trucks" className="glass-card p-5 block">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center justify-center rounded-xl" 
              style={{ width: 48, height: 48, background: "rgba(232, 168, 56, 0.08)" }}
            >
              <Truck size={24} style={{ color: "var(--accent-amber)" }} />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Manage Fleet</p>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{trucks.length} trucks registered</p>
            </div>
          </div>
        </Link>

        <Link to="/maintenance" className="glass-card p-5 block">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center justify-center rounded-xl" 
              style={{ width: 48, height: 48, background: "rgba(196, 120, 42, 0.08)" }}
            >
              <Wrench size={24} style={{ color: "var(--accent-orange)" }} />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Maintenance</p>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{overdueMaint} overdue alerts</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
