import { useNavigate } from "react-router";
import { auth } from "@/lib/firebase";
import { useDriverName } from "@/hooks/useDriverName";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { usePendingChecklistItems } from "@/hooks/usePendingChecklistItems";
import { signOut } from "firebase/auth";
import { AlertTriangle, ClipboardCheck, Fuel, LogOut, Truck, ChevronRight } from "lucide-react";

export default function DriverHome() {
  const navigate = useNavigate();
  const driverName = useDriverName();
  const { user } = useFirebaseAuth();
  // Itens que o motorista marcou como "atenção" ou "ruim" e que a oficina
  // ainda não resolveu. Antes só apareciam depois de abrir o checklist.
  const { pendingItems } = usePendingChecklistItems(user?.email || "");

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header className="glass-card sticky top-0 z-10 border-b" style={{ borderColor: "var(--border-divider)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg" style={{ width: 40, height: 40, background: "var(--accent-green)" }}>
              <Truck size={20} color="#fff" />
            </div>
            <div>
              <h1 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>FleetPulse</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Drag n' Drop</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm" style={{ color: "var(--text-muted)" }}>
            <LogOut size={16} /> Exit / Sair
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Greeting */}
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Hello, {driverName}!
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Olá, {driverName}! • {today}
          </p>
        </div>

        {pendingItems.length > 0 && (
          <button
            onClick={() => navigate("/checklist")}
            className="w-full p-4 rounded-2xl text-left"
            style={{
              background: "rgba(232,168,56,0.10)",
              border: "1px solid rgba(232,168,56,0.30)",
            }}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: "var(--accent-amber)" }}>
                  {pendingItems.length} open {pendingItems.length === 1 ? "issue" : "issues"}
                  <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                    {" "}/ {pendingItems.length === 1 ? "problema em aberto" : "problemas em aberto"}
                  </span>
                </p>
              </div>
              <ChevronRight size={18} style={{ color: "var(--text-muted)" }} />
            </div>

            <ul className="mt-3 space-y-1">
              {pendingItems.slice(0, 3).map((item, i) => (
                <li key={`${item.reportId}-${item.id}-${i}`} className="text-xs flex items-start gap-2">
                  <span
                    className="mt-1 rounded-full flex-shrink-0"
                    style={{
                      width: 6,
                      height: 6,
                      background: item.status === "bad" ? "#ef4444" : "var(--accent-amber)",
                    }}
                  />
                  <span style={{ color: "var(--text-secondary)" }}>
                    <span className="mono-font" style={{ color: "var(--text-primary)" }}>
                      {item.truckName}
                    </span>{" "}
                    — {item.labelPt || item.label}
                  </span>
                </li>
              ))}
              {pendingItems.length > 3 && (
                <li className="text-xs pl-4" style={{ color: "var(--text-muted)" }}>
                  +{pendingItems.length - 3} more / mais
                </li>
              )}
            </ul>
          </button>
        )}

        <p style={{ color: "var(--text-secondary)" }}>
          What would you like to do? <span style={{ color: "var(--text-muted)" }}>/ O que você quer fazer?</span>
        </p>

        {/* Checklist button */}
        <button
          onClick={() => navigate("/checklist")}
          className="glass-card w-full p-5 flex items-center gap-4 text-left transition-all"
        >
          <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 54, height: 54, background: "rgba(74,155,106,0.15)" }}>
            <ClipboardCheck size={28} style={{ color: "var(--accent-green)" }} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>Daily Checklist</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Truck inspection / Inspeção do caminhão</p>
          </div>
          <ChevronRight size={22} style={{ color: "var(--text-muted)" }} />
        </button>

        {/* Fuel button */}
        <button
          onClick={() => navigate("/fuel")}
          className="glass-card w-full p-5 flex items-center gap-4 text-left transition-all"
        >
          <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 54, height: 54, background: "rgba(232,168,56,0.15)" }}>
            <Fuel size={28} style={{ color: "var(--accent-amber)" }} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>Fuel Log</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Register refuel / Registrar abastecimento</p>
          </div>
          <ChevronRight size={22} style={{ color: "var(--text-muted)" }} />
        </button>

        <p className="text-center text-xs pt-4" style={{ color: "var(--text-muted)" }}>
          Drive safe! / Dirija com segurança!
        </p>
      </main>
    </div>
  );
}
