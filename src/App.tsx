import { Routes, Route, Navigate } from "react-router";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Trucks from "./pages/Trucks";
import TruckDetails from "./pages/TruckDetails";
import Maintenance from "./pages/Maintenance";
import Fuel from "./pages/Fuel";
import Inventory from "./pages/Inventory";
import Alerts from "./pages/Alerts";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import { useFirebaseAuth } from "./hooks/useFirebaseAuth";

function ProtectedLayout() {
  const { isLoading, isAuthenticated } = useFirebaseAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="inline-block w-10 h-10 rounded-full animate-spin border-3 border-amber-500 border-t-transparent mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/trucks" element={<Trucks />} />
        <Route path="/trucks/:id" element={<TruckDetails />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/fuel" element={<Fuel />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}
