import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * O que a manutenção devolve para o cadastro do caminhão
 * ──────────────────────────────────────────────────────
 * O campo `lastOilChangeMiles` só era gravado pelo formulário do caminhão.
 * Resultado: você concluía uma troca de óleo e o alerta do Dashboard continuava
 * acusando atraso até alguém lembrar de abrir Fleet e digitar a milhagem na
 * mão. Como o trabalho manual se repetia, deixava de ser feito, e o alerta
 * virava ruído que todo mundo aprende a ignorar.
 */

interface OilChangeRecord {
  truckId?: string;
  type?: string;
  mileage?: number;
}

/** Reconhece a manutenção como troca de óleo, em inglês ou português. */
export function isOilChange(type: string | undefined): boolean {
  const t = (type || "").toLowerCase();
  return t.includes("oil") || t.includes("óleo") || t.includes("oleo");
}

/**
 * Ao concluir uma troca de óleo, registra a milhagem do serviço como a da
 * última troca do caminhão. Devolve a milhagem gravada, ou null se não havia
 * nada a fazer.
 */
export async function applyOilChangeToTruck(
  record: OilChangeRecord
): Promise<number | null> {
  if (!record?.truckId || !isOilChange(record.type)) return null;

  try {
    const ref = doc(db, "trucks", record.truckId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const data = snap.data() as any;
    const currentKm = Number(data.currentKm) || 0;
    // A ordem costuma trazer a milhagem do serviço; se vier vazia, usa a atual.
    const miles = Number(record.mileage) || currentKm;
    if (miles <= 0) return null;

    // Não retrocede: se a última troca registrada já é mais recente, ignora.
    const lastRegistered = Number(data.lastOilChangeMiles) || 0;
    if (miles <= lastRegistered) return null;

    await updateDoc(ref, { lastOilChangeMiles: String(miles) });
    return miles;
  } catch (err) {
    console.error("Could not update the truck's last oil change:", err);
    return null;
  }
}

/**
 * Confere se a milhagem informada num abastecimento faz sentido.
 * Um dígito a menos (5.000 no lugar de 50.000) faz a milhagem do caminhão
 * andar para trás e contamina MPG, alerta de óleo e relatórios — tudo em
 * silêncio, porque o código trata diferença negativa como zero.
 */
export function checkOdometer(
  entered: number,
  truckCurrentKm: number | string | undefined
): { ok: boolean; current: number } {
  const current = Number(truckCurrentKm) || 0;
  return { ok: !(current > 0 && entered > 0 && entered < current), current };
}
