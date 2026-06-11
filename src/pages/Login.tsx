import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Truck, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { login, isAuthenticated } = useFirebaseAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-obsidian)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center rounded-full mx-auto mb-4" style={{ width: 64, height: 64, background: "var(--bg-elevated)" }}>
            <Truck size={32} style={{ color: "var(--accent-amber)" }} />
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>FleetPulse</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Fleet Management System</p>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Sign In</h2>

          {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(184, 64, 64, 0.1)", color: "var(--accent-red)", border: "1px solid rgba(184, 64, 64, 0.2)" }}>{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="glass-input w-full pl-10" placeholder="you@company.com" required />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="glass-input w-full pl-10 pr-10" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/register" className="text-sm" style={{ color: "var(--accent-amber)" }}>Don't have an account? Register</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
