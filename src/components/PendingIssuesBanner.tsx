import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import type { PendingItem } from "@/hooks/usePendingChecklistItems";

interface Props {
  /** A página faz a consulta e passa o resultado — ela também precisa saber
   *  quantos problemas existem, para exigir o reconhecimento antes do envio. */
  pendingItems: PendingItem[];
  loading: boolean;
  error: string | null;
  degraded: boolean;
}

export default function PendingIssuesBanner({ pendingItems, loading, error, degraded }: Props) {
  if (loading) return null;

  // Falha na consulta: avisa em vez de sumir. Uma faixa vazia faz o motorista
  // acreditar que o caminhão está limpo, o que é pior do que um aviso.
  if (error) {
    return (
      <div
        className="mb-4 p-3 rounded-xl border"
        style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>
          Não foi possível carregar os problemas pendentes
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Could not load pending issues. Avise o administrador — código: {error}
        </p>
      </div>
    );
  }

  if (pendingItems.length === 0) return null;

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
        Problemas em aberto deste caminhão, reportados por você ou por outro motorista.
        Aguardando a oficina — não é necessário reportar de novo.
        <br />
        <span style={{ color: "var(--text-muted)" }}>
          Open issues on this truck. Waiting for the shop — no need to report again.
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
                {item.daysOpen > 0 && (
                  <span style={{ color: item.daysOpen >= 7 ? "#ef4444" : "var(--text-muted)" }}>
                    {" "}• aberto há {item.daysOpen} {item.daysOpen === 1 ? "dia" : "dias"}
                  </span>
                )}
                {item.timesReported > 1 && (
                  <span> • reportado {item.timesReported}x</span>
                )}
                {item.reportedBy && <span> • por {item.reportedBy}</span>}
              </p>
            </div>
          </div>
        ))}
      </div>

      {degraded && (
        <p className="text-xs mt-3" style={{ color: "var(--accent-amber)" }}>
          Mostrando apenas o que você reportou — a lista completa do caminhão não pôde ser carregada.
        </p>
      )}

      <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: "var(--border-divider)" }}>
        <CheckCircle2 size={14} style={{ color: "var(--accent-green)" }} />
        <p className="text-xs" style={{ color: "var(--accent-green)" }}>
          Será removido automaticamente quando o administrador marcar como resolvido.
        </p>
      </div>
    </div>
  );
}
