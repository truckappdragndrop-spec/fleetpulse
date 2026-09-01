import { addDoc, collection, doc, runTransaction, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Movimentação de estoque das ordens de serviço
 * ─────────────────────────────────────────────
 * Duas coisas estavam erradas antes e são corrigidas aqui.
 *
 * 1. A devolução perdia unidades. O código antigo repetia o id da peça pela
 *    quantidade (3 filtros viravam [filtro, filtro, filtro]) e, dentro do
 *    laço, lia a quantidade da cópia em memória — que não muda a cada volta.
 *    As três iterações liam "5" e gravavam "6": devolvia 3, subia 1.
 *    Agora cada peça é ajustada uma única vez, dentro de uma transação que lê
 *    o valor real no banco na hora da escrita.
 *
 * 2. Peça consumida em ordem de serviço não deixava rastro no histórico do
 *    Inventory — só a saída manual escrevia lá. Agora toda movimentação é
 *    registrada, marcada com `source: "maintenance"` e o número da ordem.
 */

export interface StockLine {
  partId: string;
  partName: string;
  /** Sempre positivo: quantas unidades a ordem usa. */
  quantity: number;
  unitCost: number;
}

export interface WorkOrderContext {
  woNumber: string;
  maintenanceId?: string;
  truckName: string;
  /** yyyy-MM-dd */
  date: string;
}

/**
 * Soma `delta` ao saldo da peça dentro de uma transação. Nunca deixa o saldo
 * negativo. Devolve quanto faltou, quando faltou.
 */
export async function adjustStock(
  partId: string,
  delta: number
): Promise<{ before: number; after: number; shortage: number }> {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "parts", partId);
    const snap = await tx.get(ref);
    const before = snap.exists() ? Number(snap.data().quantity || 0) : 0;
    const wanted = before + delta;
    const after = Math.max(0, wanted);
    tx.update(ref, { quantity: after, updatedAt: Timestamp.now() });
    return { before, after, shortage: wanted < 0 ? -wanted : 0 };
  });
}

/** Uma linha no histórico do Inventory. */
async function recordMovement(
  line: StockLine,
  ctx: WorkOrderContext,
  direction: "out" | "in"
) {
  const signedQty = direction === "out" ? line.quantity : -line.quantity;
  await addDoc(collection(db, "partsHistory"), {
    partId: line.partId,
    partName: line.partName,
    truck: ctx.truckName,
    quantity: signedQty,
    totalCost: signedQty * line.unitCost,
    reason:
      direction === "out"
        ? `Work order ${ctx.woNumber}`
        : `Returned from ${ctx.woNumber}`,
    date: ctx.date,
    // Marca a origem. O Dashboard soma o custo de peças do histórico e o
    // custo das manutenções separadamente — sem esta marca, peça usada em
    // ordem de serviço seria contada duas vezes no total da frota.
    source: "maintenance",
    woNumber: ctx.woNumber,
    maintenanceId: ctx.maintenanceId || null,
    createdAt: Timestamp.now(),
  });
}

/** Desconta as peças da ordem e registra a saída no histórico. */
export async function consumeParts(lines: StockLine[], ctx: WorkOrderContext) {
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    await adjustStock(line.partId, -line.quantity);
    await recordMovement(line, ctx, "out");
  }
}

/** Devolve as peças ao estoque e registra a entrada no histórico. */
export async function returnParts(lines: StockLine[], ctx: WorkOrderContext) {
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    await adjustStock(line.partId, line.quantity);
    await recordMovement(line, ctx, "in");
  }
}

/**
 * Confere o saldo antes de gravar, para a tela poder avisar em vez de
 * descontar em silêncio o que não existe.
 */
export function findShortages(
  lines: StockLine[],
  parts: { id: string; name?: string; quantity: number }[] | undefined
): { partName: string; needed: number; available: number }[] {
  return lines
    .map((line) => {
      const part = parts?.find((p) => p.id === line.partId);
      const available = Number(part?.quantity || 0);
      return { partName: line.partName, needed: line.quantity, available };
    })
    .filter((s) => s.needed > s.available);
}
