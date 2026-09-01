import { nextSequence, formatSequence } from "@/lib/sequence";

/**
 * Numeração das ordens de serviço
 * ────────────────────────────────
 * Cada manutenção recebe um número sequencial — WO-0001, WO-0002 — igual a
 * talonário de oficina. O contador em si vive em `lib/sequence.ts`, que é
 * compartilhado com o código interno das peças.
 */

export function formatWoNumber(n: number): string {
  return formatSequence("WO", n);
}

/**
 * Reserva e devolve o próximo número da sequência.
 *
 * Se o contador não puder ser gravado (regra de segurança ainda não publicada,
 * internet caindo no meio), devolve um número provisório baseado em data e
 * hora — nunca repetido — em vez de impedir a criação da ordem. A flag
 * `provisional` avisa a tela para mostrar um aviso.
 */
export async function nextWorkOrderNumber(): Promise<{
  number: string;
  provisional: boolean;
}> {
  return nextSequence("workOrders", "WO");
}

/**
 * O que mostrar na tela. Registros criados antes desta funcionalidade não têm
 * `woNumber` gravado — para esses, deriva um código do identificador do
 * documento, que é o comportamento que a ordem impressa já tinha.
 */
export function displayWoNumber(record: { woNumber?: string; id?: string } | null | undefined): string {
  if (!record) return "";
  if (record.woNumber) return record.woNumber;
  if (record.id) return "WO-" + record.id.slice(-6).toUpperCase();
  return "";
}

/**
 * Texto pelo qual uma ordem de serviço pode ser encontrada na busca.
 * Aceita as formas que a pessoa realmente digita: "WO-0042", "wo42", "0042"
 * ou só "42" — inclusive para os registros antigos, que usam o código
 * derivado do identificador.
 */
export function woSearchTerms(record: { woNumber?: string; id?: string } | null | undefined): string {
  const full = displayWoNumber(record);
  if (!full) return "";
  const withoutPrefix = full.replace(/^WO-/i, "");
  const withoutZeros = withoutPrefix.replace(/^0+/, "");
  return [full, withoutPrefix, withoutZeros, full.replace(/-/g, "")].join(" ").toLowerCase();
}
