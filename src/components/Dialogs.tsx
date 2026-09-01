import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

/**
 * Avisos e confirmações do FleetPulse
 * ───────────────────────────────────
 * Substitui os `alert()` e `confirm()` do navegador. Além de destoarem do
 * visual, eles travam a página inteira, mostram o endereço do site no topo da
 * caixa e, no celular, aparecem colados no topo da tela — parecem aviso de
 * vírus, não parte do aplicativo.
 *
 * Uso:
 *   const { confirm, notify } = useDialogs();
 *
 *   notify("Salvo com sucesso", "success");
 *
 *   if (!(await confirm({ title: "Apagar caminhão?", danger: true }))) return;
 */

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  /** Texto explicativo abaixo do título. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Deixa o botão de confirmar vermelho (apagar, remover). */
  danger?: boolean;
}

interface DialogsApi {
  notify: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const DialogsContext = createContext<DialogsApi | null>(null);

export function useDialogs(): DialogsApi {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error("useDialogs precisa estar dentro de <DialogsProvider>");
  return ctx;
}

const TOAST_STYLES: Record<ToastType, { color: string; icon: typeof Info }> = {
  success: { color: "var(--accent-green)", icon: CheckCircle2 },
  error: { color: "var(--accent-red)", icon: XCircle },
  warning: { color: "var(--accent-orange)", icon: AlertTriangle },
  info: { color: "var(--accent-amber)", icon: Info },
};

export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (value: boolean) => void }) | null
  >(null);
  const nextId = useRef(1);

  const notify = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const closeConfirm = useCallback(
    (answer: boolean) => {
      setConfirmState((current) => {
        current?.resolve(answer);
        return null;
      });
    },
    []
  );

  // Esc cancela, Enter confirma
  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeConfirm(false);
      if (e.key === "Enter") closeConfirm(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmState, closeConfirm]);

  return (
    <DialogsContext.Provider value={{ notify, confirm }}>
      {children}

      {/* ───── Avisos ───── */}
      <div
        className="fixed z-[60] flex flex-col gap-2 pointer-events-none left-4 right-4 sm:left-auto sm:right-6 sm:w-80"
        style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
      >
        {toasts.map((toast) => {
          const { color, icon: Icon } = TOAST_STYLES[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              className="animate-fade-in pointer-events-auto flex items-start gap-3 rounded-xl p-3 shadow-lg"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                borderLeft: `3px solid ${color}`,
              }}
            >
              <Icon size={18} style={{ color, flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>
                {toast.message}
              </p>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                aria-label="Close"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ───── Confirmação ───── */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => closeConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl p-5 animate-fade-in"
            style={{ background: "var(--bg-panel-solid)", border: "1px solid var(--border-subtle)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {confirmState.title}
            </h2>
            {confirmState.message && (
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                {confirmState.message}
              </p>
            )}
            <div className="mt-5 flex gap-3 justify-end">
              <button className="btn-ghost text-sm" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel || "Cancel"}
              </button>
              <button
                autoFocus
                className="btn-primary text-sm"
                style={
                  confirmState.danger
                    ? { background: "var(--accent-red)", color: "var(--text-primary)" }
                    : undefined
                }
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogsContext.Provider>
  );
}
