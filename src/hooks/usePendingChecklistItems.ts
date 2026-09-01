import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface PendingItem {
  id: string;
  label: string;
  labelPt?: string;
  status: "fair" | "bad";
  notes: string;
  photoUrl?: string;
  reportId: string;
  submittedAt: string;
  truckName: string;
  /** Quem reportou — pode ser outro motorista que dirigiu o mesmo caminhão. */
  reportedBy: string;
  /** Quantos dias o problema está em aberto. */
  daysOpen: number;
  /** Quantas vezes foi reportado antes de ser resolvido. */
  timesReported: number;
}

/**
 * Problemas em aberto que o motorista precisa enxergar.
 *
 * Com um caminhão escolhido, a busca é **pelo caminhão**: o problema pertence
 * ao veículo, não a quem o reportou. Sem isso, o motorista que pegasse o
 * caminhão no dia seguinte não via nada e reportava a mesma coisa de novo.
 * Sem caminhão escolhido (tela inicial), mostra o que o próprio motorista
 * reportou e ainda não foi resolvido.
 */
export function usePendingChecklistItems(driverEmail: string, truckId?: string) {
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** Mensagem de falha, para a tela poder avisar em vez de ficar vazia. */
  const [error, setError] = useState<string | null>(null);
  /** true quando a busca por caminhão falhou e caímos na busca por motorista. */
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    if (!truckId && !driverEmail) return;

    const buildQuery = (byTruck: boolean) =>
      query(
        collection(db, "driverChecklists"),
        byTruck
          ? where("truckId", "==", truckId as string)
          : where("driverEmail", "==", driverEmail),
        where("status", "in", ["needs_review", "resolved"]),
        orderBy("submittedAt", "desc"),
        // Antes eram 10. Um motorista que inspeciona todo dia perdia de vista
        // um problema não resolvido depois de duas semanas — justamente o
        // contrário do que esta faixa promete.
        limit(50)
      );

    const loadPending = async () => {
      setLoading(true);
      setError(null);
      setDegraded(false);
      try {
        let snap;
        try {
          snap = await getDocs(buildQuery(Boolean(truckId)));
        } catch (firstErr) {
          // A busca por caminhão precisa de um índice próprio no Firestore e de
          // permissão de leitura da frota. Faltando qualquer um dos dois, cai
          // para a busca por motorista — que já funcionava — em vez de deixar
          // a faixa vazia e o motorista sem informação nenhuma.
          if (!truckId || !driverEmail) throw firstErr;
          console.error("Truck-scoped query failed, falling back to driver:", firstErr);
          snap = await getDocs(buildQuery(false));
          setDegraded(true);
        }
        // Chaveado pelo id do item: o mesmo problema reportado em vários dias
        // aparecia repetido na lista. Fica um só, contando as repetições e
        // datado do primeiro relato — o que interessa é há quanto tempo está
        // aberto, não quantas vezes foi digitado.
        const byItem = new Map<string, PendingItem>();

        snap.docs.forEach(doc => {
          const data = doc.data();

          const resolvedItems = data.resolvedItems || [];
          const checklist = data.checklist || [];

          checklist.forEach((item: any) => {
            const state = item.status || (item.checked ? "ok" : "bad");
            if ((state === "fair" || state === "bad") && !resolvedItems.includes(item.id)) {
              const existing = byItem.get(item.id);
              if (existing) {
                existing.timesReported += 1;
                // Mantém o relato mais antigo como origem do problema.
                if (String(data.submittedAt || "") < existing.submittedAt) {
                  existing.submittedAt = data.submittedAt;
                  existing.reportId = doc.id;
                }
                // Guarda a observação e a foto mais recentes, se houver.
                if (!existing.notes && item.notes) existing.notes = item.notes;
                if (!existing.photoUrl && item.photoUrl) existing.photoUrl = item.photoUrl;
                return;
              }
              byItem.set(item.id, {
                id: item.id,
                label: item.label,
                labelPt: item.labelPt,
                status: state,
                notes: item.notes || "",
                photoUrl: item.photoUrl,
                reportId: doc.id,
                submittedAt: data.submittedAt,
                truckName: data.truckName || data.truckId,
                reportedBy: data.driverName || data.driverEmail || "",
                daysOpen: 0,
                timesReported: 1,
              });
            }
          });
        });

        const today = Date.now();
        const items = Array.from(byItem.values()).map(item => {
          const reported = new Date(item.submittedAt).getTime();
          const daysOpen = isNaN(reported)
            ? 0
            : Math.max(0, Math.floor((today - reported) / 86400000));
          return { ...item, daysOpen };
        });
        // Mais graves primeiro; entre iguais, os mais antigos.
        items.sort((a, b) =>
          a.status === b.status ? b.daysOpen - a.daysOpen : a.status === "bad" ? -1 : 1
        );

        setPendingItems(items);
      } catch (err: any) {
        console.error("Error loading pending items:", err);
        setPendingItems([]);
        setError(
          err?.code === "permission-denied"
            ? "permission-denied"
            : String(err?.message || "unknown")
        );
      } finally {
        setLoading(false);
      }
    };

    loadPending();
  }, [driverEmail, truckId]);

  return { pendingItems, loading, error, degraded };
}
