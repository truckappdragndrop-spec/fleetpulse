import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import ParticleBackground from "./ParticleBackground";
import {
  LayoutDashboard, Truck, Wrench, Droplets, Package, Bell, LogOut, 
  ChevronRight, Menu, X,
} from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/trucks", label: "Fleet", icon: Truck },
  { path: "/maintenance", label: "Maintenance", icon: Wrench },
  { path: "/fuel", label: "Fuel", icon: Droplets },
  { path: "/inventory", label: "Parts", icon: Package },
  { path: "/alerts", label: "Alerts", icon: Bell },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useFirebaseAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white relative">
      <ParticleBackground />
      <div className="relative z-10 flex">
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-neutral-900/90 backdrop-blur-xl border-r border-white/10 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:block`}>
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h1 className="text-xl font-bold text-emerald-400">FleetPulse</h1>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2">
              <X size={20} />
            </button>
          </div>
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                  {isActive && <ChevronRight size={16} className="ml-auto" />}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
            <button onClick={logout} className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 transition-colors w-full">
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-neutral-900/90 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-2">
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-bold text-emerald-400">FleetPulse</h1>
          <div className="w-8" />
        </div>

        <main className="flex-1 p-6 lg:p-8 mt-16 lg:mt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
