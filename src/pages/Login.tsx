import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Truck, Mail, Lock, Eye, EyeOff } from "lucide-react";

/**
 * Traduz o código do Firebase para uma frase que diz o que fazer.
 * Antes, toda falha virava "email ou senha inválidos" — inclusive bloqueio
 * por tentativas, falta de internet e erro de configuração. Quem via a
 * mensagem ficava tentando a senha de novo, que era justamente o que piorava.
 */
function authErrorMessage(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password / E-mail ou senha inválidos";
    case "auth/too-many-requests":
      return "Too many attempts — this account is temporarily blocked. Wait a few minutes or reset your password below. / Muitas tentativas: conta bloqueada por alguns minutos. Espere ou redefina a senha abaixo.";
    case "auth/user-disabled":
      return "This account is disabled / Esta conta está desativada";
    case "auth/invalid-email":
      return "Check the e-mail address / Verifique o endereço de e-mail";
    case "auth/network-request-failed":
      return "No connection to Firebase / Sem conexão com o Firebase. Verifique a internet.";
    case "auth/invalid-api-key":
    case "auth/configuration-not-found":
      return "App configuration problem (.env) — not a password issue / Problema de configuração do app, não é a senha.";
    default:
      return `Could not sign in / Não foi possível entrar (${code})`;
  }
}

export default function Login() {
  const { login, isAuthenticated, resetPassword } = useFirebaseAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err: any) {
      // O código fica no console para diagnóstico, e a frase explica o caso.
      console.error("Sign-in failed:", err?.code, err);
      setError(authErrorMessage(err?.code || "unknown"));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      setError("Type your e-mail above first / Digite seu e-mail acima primeiro");
      return;
    }
    setError("");
    setInfo("");
    try {
      await resetPassword(email);
      setInfo(`Reset link sent to ${email} — check your inbox and spam. / Link enviado, veja a caixa de entrada e o spam.`);
    } catch (err: any) {
      console.error("Password reset failed:", err?.code, err);
      setError(authErrorMessage(err?.code || "unknown"));
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
          {info && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(74, 155, 106, 0.1)", color: "var(--accent-green)", border: "1px solid rgba(74, 155, 106, 0.25)" }}>{info}</div>}

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

          <button
            type="button"
            onClick={handleReset}
            className="w-full text-center text-sm mt-4"
            style={{ color: "var(--text-muted)" }}
          >
            Forgot your password? <span style={{ color: "var(--accent-amber)" }}>Reset by e-mail</span>
          </button>
        </div>
      </div>
    </div>
  );
}
