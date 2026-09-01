import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Contadores sequenciais
 * ──────────────────────
 * Cada contador vive num documento em `counters/{id}` e é incrementado dentro
 * de uma transação: se dois cadastros acontecerem no mesmo segundo, o Firestore
 * refaz a operação em vez de entregar o mesmo número para os dois.
 *
 * Usado pelas ordens de serviço (WO-0001) e pelo código interno das peças
 * (P-0001). Era código repetido — agora é um só.
 */

export interface SequenceResult {
  /** Já formatado, ex. "WO-0042". */
  number: string;
  /** true quando o contador não pôde ser gravado e o número é provisório. */
  provisional: boolean;
}

export function formatSequence(prefix: string, n: number, pad = 4): string {
  return `${prefix}-${String(n).padStart(pad, "0")}`;
}

/**
 * Reserva o próximo número da sequência `counterId`.
 *
 * Se o contador não puder ser gravado (regra de segurança ainda não publicada,
 * internet caindo no meio), devolve um número provisório baseado em data e
 * hora — nunca repetido — em vez de impedir o cadastro. Quem chama decide se
 * avisa o usuário, olhando `provisional`.
 */
export async function nextSequence(
  counterId: string,
  prefix: string,
  pad = 4
): Promise<SequenceResult> {
  try {
    const value = await runTransaction(db, async (tx) => {
      const ref = doc(db, "counters", counterId);
      const snap = await tx.get(ref);
      const next = snap.exists() ? Number(snap.data().next || 0) + 1 : 1;
      tx.set(ref, { next }, { merge: true });
      return next;
    });
    return { number: formatSequence(prefix, value, pad), provisional: false };
  } catch (err) {
    console.error(`Could not reserve a number from counter "${counterId}":`, err);
    const d = new Date();
    const stamp =
      String(d.getFullYear()).slice(2) +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0") +
      "-" +
      String(d.getHours()).padStart(2, "0") +
      String(d.getMinutes()).padStart(2, "0");
    return { number: `${prefix}-${stamp}`, provisional: true };
  }
}
