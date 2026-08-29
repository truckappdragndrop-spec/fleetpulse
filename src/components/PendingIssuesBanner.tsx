import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { usePendingChecklistItems } from "@/hooks/usePendingChecklistItems";

interface Props {
  driverEmail: string;
  truckId?: string;
}

export default function PendingIssuesBanner({ driverEmail, truckId }: Props) {
  const { pendingItems, loading } = usePendingChecklistItems(driverEmail, truckId);

  if (loading) return null;
  if (pendingItems.length === 0) return null;

  const fairCount = pendingItems.filter(i => i.status === "fair").length;
  const badCount = pendingItems.filter(i => i.status === "bad").length;

  return (
    <div className="mb-4 p-4 rounded-xl border" style={{
      background: "rgba(245,158,11,0.08)",
      borderColor: "rgba(245,158,11,0.3)"
    }}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={20} style={{ color: "var(--accent-amber)" }} />
        <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
          Problemas Pendentes / Pending Issues
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{
          background: "rgba(245,158,11,0.15)",
          color: "var(--accent-amber)"
        }}>
          {pendingItems.length}
        </span>
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Aguardando resolução da oficina. Não é necessário reportar novamente.
        <br />
        <span style={{ color: "var(--text-muted)" }}>
          Waiting for shop resolution. No need to report again.
        </span>
      </p>

      <div className="space-y-2">
        {pendingItems.map(item => (
          <div
            key={item.id}
            className="flex items-start gap-2 p-2 rounded-lg"
            style={{
              background: item.status === "bad"
                ? "rgba(239,68,68,0.08)"
                : "rgba(245,158,11,0.08)",
              border: `1px solid ${item.status === "bad"
                ? "rgba(239,68,68,0.2)"
                : "rgba(245,158,11,0.2)"}`
            }}
          >
            {item.status === "bad" ? (
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
            ) : (
              <Clock size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent-amber)" }} />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {item.label}
                <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded" style={{
                  background: item.status === "bad"
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(245,158,11,0.15)",
                  color: item.status === "bad" ? "#ef4444" : "var(--accent-amber)"
                }}>
                  {item.status === "bad" ? "BAD" : "FAIR"}
                </span>
              </p>
              {item.labelPt && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.labelPt}</p>
              )}
              {item.notes && (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Note: {item.notes}
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                <Clock size={10} className="inline mr-1" />
                Reportado em {new Date(item.submittedAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: "var(--border-divider)" }}>
        <CheckCircle2 size={14} style={{ color: "var(--accent-green)" }} />
        <p className="text-xs" style={{ color: "var(--accent-green)" }}>
          Será removido automaticamente quando o administrador marcar como resolvido.
        </p>
      </div>
    </div>
  );
}
