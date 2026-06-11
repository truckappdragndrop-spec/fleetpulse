import { useCollection } from "@/hooks/useCollection";
import { AlertTriangle, Clock, Wrench, CheckCircle2, Bell } from "lucide-react";
import type { Timestamp } from "firebase/firestore";

interface MaintDoc {
  id: string; fleetId: string; truckBrand: string; truckModel: string;
  maintenanceType: string; title: string; scheduledDate: string;
  status: string; priority: string; createdAt: Timestamp;
}

const maintTypes: Record<string, string> = {
  oil_change: "Oil Change", tire_inspection: "Tire Inspection", brake_check: "Brake Check",
  engine_tuneup: "Engine Tune-up", filter_replacement: "Filter Replacement",
  electrical: "Electrical", suspension: "Suspension", transmission: "Transmission",
  cooling_system: "Cooling System", other: "Other",
};

const priConfig: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: "var(--accent-green)", bg: "rgba(74, 155, 106, 0.1)", label: "Low" },
  medium: { color: "var(--accent-amber)", bg: "rgba(232, 168, 56, 0.1)", label: "Medium" },
  high: { color: "var(--accent-orange)", bg: "rgba(196, 120, 42, 0.1)", label: "High" },
  critical: { color: "var(--accent-red)", bg: "rgba(184, 64, 64, 0.1)", label: "Critical" },
};

export default function Alerts() {
  const { data: records, update } = useCollection<MaintDoc>("maintenance");
  const today = new Date().toISOString().split("T")[0];

  const overdue = records.filter((r) => r.status === "overdue" || (r.status === "pending" && r.scheduledDate <= today));
  const pending = records.filter((r) => r.status === "pending" && r.scheduledDate > today);
  const inProgress = records.filter((r) => r.status === "in_progress");

  const handleComplete = async (id: string) => { await update(id, { status: "completed", completedDate: today }); };
  const handleStart = async (id: string) => { await update(id, { status: "in_progress" }); };

  const getDaysOverdue = (date: string) => Math.floor((new Date(today).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  const getDaysUntil = (date: string) => Math.floor((new Date(date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Alerts</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Pending and overdue maintenance</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(184, 64, 64, 0.1)" }}><AlertTriangle size={20} style={{ color: "var(--accent-red)" }} /></div><div><p className="text-lg font-semibold" style={{ color: "var(--accent-red)" }}>{overdue.length}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Overdue</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(232, 168, 56, 0.1)" }}><Clock size={20} style={{ color: "var(--accent-amber)" }} /></div><div><p className="text-lg font-semibold" style={{ color: "var(--accent-amber)" }}>{pending.length}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>Pending</p></div></div>
        <div className="glass-card p-4 flex items-center gap-3"><div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(74, 155, 106, 0.1)" }}><Wrench size={20} style={{ color: "var(--accent-green)" }} /></div><div><p className="text-lg font-semibold" style={{ color: "var(--accent-green)" }}>{inProgress.length}</p><p style={{ color: "var(--text-muted)", fontSize: 12 }}>In Progress</p></div></div>
      </div>

      <div className="glass-card p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-4"><AlertTriangle size={20} style={{ color: "var(--accent-red)" }} /><h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Overdue Maintenance</h2></div>
        {overdue.length > 0 ? (
          <div className="space-y-3">
            {overdue.map((alert) => {
              const days = getDaysOverdue(alert.scheduledDate);
              const pri = priConfig[alert.priority];
              return <div key={alert.id} className="flex items-start gap-4 p-4 rounded-xl" style={{ background: "rgba(184, 64, 64, 0.05)", borderLeft: "3px solid var(--accent-red)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1"><span className="mono-font text-sm font-medium" style={{ color: "var(--accent-amber)" }}>{alert.fleetId}</span><span className="text-xs px-2 py-0.5 rounded-md" style={{ background: pri.bg, color: pri.color }}>{pri.label}</span></div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{alert.title}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{alert.truckBrand} {alert.truckModel} - {maintTypes[alert.maintenanceType]}</p>
                  <div className="flex items-center gap-3 mt-2"><span className="text-xs flex items-center gap-1" style={{ color: "var(--accent-red)" }}><Bell size={12} />{days} {days === 1 ? "day" : "days"} overdue</span><span className="text-xs" style={{ color: "var(--text-muted)" }}>Due: {alert.scheduledDate}</span></div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleStart(alert.id)} className="p-2 rounded-lg" style={{ color: "var(--accent-amber)", background: "rgba(232, 168, 56, 0.1)" }} title="Start"><Wrench size={16} /></button>
                  <button onClick={() => handleComplete(alert.id)} className="p-2 rounded-lg" style={{ color: "var(--accent-green)", background: "rgba(74, 155, 106, 0.1)" }} title="Complete"><CheckCircle2 size={16} /></button>
                </div>
              </div>;
            })}
          </div>
        ) : <div className="text-center py-8"><CheckCircle2 size={40} className="mx-auto mb-2" style={{ color: "var(--accent-green)", opacity: 0.5 }} /><p style={{ color: "var(--text-muted)" }}>No overdue maintenance!</p></div>}
      </div>

      <div className="glass-card p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-4"><Clock size={20} style={{ color: "var(--accent-amber)" }} /><h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Upcoming Maintenance</h2></div>
        {pending.length > 0 ? (
          <div className="space-y-3">
            {pending.slice(0, 10).map((alert) => {
              const days = getDaysUntil(alert.scheduledDate);
              const pri = priConfig[alert.priority];
              return <div key={alert.id} className="flex items-start gap-4 p-4 rounded-xl" style={{ background: "rgba(255, 255, 255, 0.02)", borderLeft: `3px solid ${days <= 3 ? "var(--accent-orange)" : "var(--accent-amber)"}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1"><span className="mono-font text-sm font-medium" style={{ color: "var(--accent-amber)" }}>{alert.fleetId}</span><span className="text-xs px-2 py-0.5 rounded-md" style={{ background: pri.bg, color: pri.color }}>{pri.label}</span></div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{alert.title}</p>
                  <div className="flex items-center gap-3 mt-2"><span className="text-xs flex items-center gap-1" style={{ color: days <= 3 ? "var(--accent-orange)" : "var(--accent-amber)" }}><Clock size={12} />{days === 0 ? "Today" : `In ${days} ${days === 1 ? "day" : "days"}`}</span><span className="text-xs" style={{ color: "var(--text-muted)" }}>{maintTypes[alert.maintenanceType]}</span></div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleStart(alert.id)} className="p-2 rounded-lg" style={{ color: "var(--accent-amber)", background: "rgba(232, 168, 56, 0.1)" }} title="Start"><Wrench size={16} /></button>
                  <button onClick={() => handleComplete(alert.id)} className="p-2 rounded-lg" style={{ color: "var(--accent-green)", background: "rgba(74, 155, 106, 0.1)" }} title="Complete"><CheckCircle2 size={16} /></button>
                </div>
              </div>;
            })}
          </div>
        ) : <div className="text-center py-8"><p style={{ color: "var(--text-muted)" }}>No pending maintenance</p></div>}
      </div>
    </div>
  );
}
