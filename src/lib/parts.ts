import { nextSequence } from "@/lib/sequence";

/**
 * Código interno, condição e endereço da peça no estoque
 * ─────────────────────────────────────────────────────
 * Três coisas que faltavam no cadastro:
 *
 *  • **Código interno** (P-0001) — o número da SUA prateleira, sequencial.
 *    Não confundir com `partNumber`, que é o número do FABRICANTE, o que você
 *    fala com o fornecedor. Os dois convivem e servem a conversas diferentes.
 *
 *  • **Condição** — nova, usada ou recondicionada. Peça de caminhão tem preço
 *    e garantia bem diferentes conforme a origem, então a mesma peça em duas
 *    condições são dois cadastros.
 *
 *  • **Endereço** — prateleira, nível e espaço em campos separados, para dar
 *    para filtrar "tudo da prateleira A" e ordenar a lista virando roteiro de
 *    conferência. Um campo de texto livre não permitiria nem uma coisa nem
 *    outra, porque cada pessoa escreveria de um jeito.
 */

export type PartCondition = "new" | "used" | "rebuilt";

export const PART_CONDITIONS: {
  value: PartCondition;
  label: string;
  labelPt: string;
  color: string;
  bg: string;
}[] = [
  { value: "new", label: "New", labelPt: "Nova", color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  { value: "used", label: "Used", labelPt: "Usada", color: "#eab308", bg: "rgba(234,179,8,0.15)" },
  { value: "rebuilt", label: "Rebuilt", labelPt: "Recondicionada", color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
];

export function conditionInfo(value?: string) {
  return PART_CONDITIONS.find((c) => c.value === value) || PART_CONDITIONS[0];
}

/** Reserva o próximo código interno: P-0001, P-0002... */
export async function nextPartCode() {
  return nextSequence("parts", "P");
}

/** Peças cadastradas antes desta funcionalidade não têm código gravado. */
export function displayPartCode(part: { partCode?: string; id?: string } | null | undefined): string {
  if (!part) return "";
  if (part.partCode) return part.partCode;
  if (part.id) return "P-" + part.id.slice(-6).toUpperCase();
  return "";
}

export interface PartLocation {
  shelf?: string;
  level?: string;
  bin?: string;
}

/** "A · 2 · A1" — ou "—" quando não há endereço cadastrado. */
export function formatLocation(part: PartLocation | null | undefined): string {
  if (!part) return "—";
  const parts = [part.shelf, part.level, part.bin]
    .map((v) => (v || "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/** Versão compacta para etiqueta e busca: "A2-A1". */
export function locationCode(part: PartLocation | null | undefined): string {
  if (!part) return "";
  const shelf = (part.shelf || "").trim();
  const level = (part.level || "").trim();
  const bin = (part.bin || "").trim();
  if (!shelf && !level && !bin) return "";
  return `${shelf}${level}${bin ? "-" + bin : ""}`.toUpperCase();
}

/**
 * Chave de ordenação: prateleira, depois nível, depois espaço — com os números
 * completados com zero à esquerda para "10" não vir antes de "2". Peças sem
 * endereço vão para o fim da lista, e não para o começo.
 */
export function locationSortKey(part: PartLocation | null | undefined): string {
  const shelf = (part?.shelf || "").trim().toUpperCase();
  if (!shelf && !part?.level && !part?.bin) return "zzzz";
  const level = (part?.level || "").trim().padStart(3, "0");
  const bin = (part?.bin || "").trim().toUpperCase().padStart(4, "0");
  return `${shelf.padEnd(3, " ")}|${level}|${bin}`;
}

/** Tudo pelo que a peça pode ser encontrada na busca. */
export function partSearchTerms(part: {
  partCode?: string;
  id?: string;
  name?: string;
  supplier?: string;
  partNumber?: string;
  category?: string;
  condition?: string;
  shelf?: string;
  level?: string;
  bin?: string;
}): string {
  const code = displayPartCode(part);
  const info = conditionInfo(part.condition);
  return [
    code,
    code.replace(/^P-0*/i, ""),
    part.name,
    part.supplier,
    part.partNumber,
    part.category,
    info.label,
    info.labelPt,
    formatLocation(part),
    locationCode(part),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
