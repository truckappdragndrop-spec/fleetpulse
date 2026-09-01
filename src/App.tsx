import { useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router";
import { doc, getDoc } from "firebase/firestore";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db } from "@/lib/firebase";
import { ClipboardCheck, Fuel as FuelNavIcon, Home } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

// Cada página vira um arquivo .js separado, baixado só quando alguém abre
// aquela tela. Antes, o primeiro acesso baixava as 12 páginas de uma vez —
// incluindo Reports e Maintenance, que são as maiores do projeto.
// O motorista, que abre o app no celular no meio da rua, era quem mais pagava
// por isso: baixava o painel administrativo inteiro sem nunca poder usá-lo.
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Trucks = lazy(() => import("@/pages/Trucks"));
const TruckDetails = lazy(() => import("@/pages/TruckDetails"));
const TruckStats = lazy(() => import("@/pages/TruckStats"));
const Maintenance = lazy(() => import("@/pages/Maintenance"));
const Fuel = lazy(() => import("@/pages/Fuel"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const Reports = lazy(() => import("@/pages/Reports"));
const Checklists = lazy(() => import("@/pages/Checklists"));
const DriverHome = lazy(() => import("@/pages/driver/DriverHome"));
const DriverChecklist = lazy(() => import("@/pages/driver/DriverChecklist"));
const DriverFuel = lazy(() => import("@/pages/driver/DriverFuel"));

// Mostrado enquanto o arquivo da página está sendo baixado
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div
        className="w-8 h-8 border-2 rounded-full animate-spin"
        style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }}
      />
    </div>
  );
}

type UserRole = "admin" | "driver" | null;

// Emails que SEMPRE são admin, mesmo se o Firestore falhar
const ADMIN_EMAILS = ["info@dragndrop.us", "rogerquerinosilva@gmail.com"];

function useUserRole(uid: string | undefined): { role: UserRole; loading: boolean } {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setRole(null);
      setLoading(false);
      return;
    }

    setRole(null);
    setLoading(true);

    const fetchRole = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setRole(data.role || "driver");
        } else {
          setRole("driver");
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setRole("driver");
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [uid]);

  return { role, loading };
}

// Barra de navegação inferior do motorista
function DriverNav() {
  const location = useLocation();
  const items = [
    { path: "/", label: "Home", icon: Home },
    { path: "/checklist", label: "Checklist", icon: ClipboardCheck },
    { path: "/fuel", label: "Fuel", icon: FuelNavIcon },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border-divider)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="max-w-2xl mx-auto flex">
        {items.map(item => {
          const isActive = item.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex-1 flex flex-col items-center gap-1 py-3"
              style={{ color: isActive ? "var(--accent-green)" : "var(--text-muted)" }}
            >
              <Icon size={22} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ProtectedLayout() {
  const { user, isLoading: authLoading } = useFirebaseAuth();
  const { role, loading: roleLoading } = useUserRole(user?.uid);

  const isLoading = authLoading || roleLoading || (!!user && role === null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--bg-primary)" }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const email = (user.email || "").toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(email) || role === "admin";

  if (!isAdmin) {
    return (
      <div style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom))", minHeight: "100vh", background: "var(--bg-primary)" }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<DriverHome />} />
            <Route path="/checklist" element={<DriverChecklist />} />
            <Route path="/fuel" element={<DriverFuel />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <DriverNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Sidebar />
      {/* A Sidebar é `position: fixed` com 16rem de largura, então o conteúdo
          precisa da margem à esquerda no desktop (senão a barra cobre a coluna
          esquerda) e de espaço no topo no celular (onde o botão do menu flutua). */}
      <main className="p-4 pt-20 sm:p-6 sm:pt-20 lg:ml-64 lg:p-8 lg:pt-8">
        <div className="max-w-7xl mx-auto">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/trucks" element={<Trucks />} />
              <Route path="/trucks/:id" element={<TruckDetails />} />
              <Route path="/trucks/:id/stats" element={<TruckStats />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/fuel" element={<Fuel />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/checklists" element={<Checklists />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}
