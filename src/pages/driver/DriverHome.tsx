import { useNavigate } from "react-router";
import { auth } from "@/lib/firebase";
import { useDriverName } from "@/hooks/useDriverName";
import { signOut } from "firebase/auth";
import { ClipboardCheck, Fuel, LogOut, Truck, ChevronRight } from "lucide-react";

export default function DriverHome() {
  const navigate = useNavigate();
  const driverName = useDriverName();

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
