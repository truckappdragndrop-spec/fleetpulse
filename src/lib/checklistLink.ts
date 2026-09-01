import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/**
 * Ligação entre a ordem de serviço e o checklist que a originou
 * ─────────────────────────────────────────────────────────────
 * Quando uma WO nasce de um checklist, a manutenção guarda `checklistId` e
 * `checklistItemId`. Ao concluir essa manutenção, o item correspondente do
 * checklist é marcado como resolvido automaticamente — antes era preciso
 * lembrar de ir até a tela de Checklists e clicar em "Fixed" de novo, e
 * esquecer disso deixava o checklist eternamente pendente.
 */

export interface ChecklistItemLike {
  id: string;
  status?: "ok" | "fair" | "bad" | null;
  checked?: boolean;
}

/** Estado real de um item: registros antigos usavam `checked` em vez de `status`. */
export function itemState(item: ChecklistItemLike): "ok" | "fair" | "bad" {
  if (item.status === "ok" || item.status === "fair" || item.status === "bad") return item.status;
  return item.checked ? "ok" : "bad";
}

interface LinkedRecord {
  checklistId?: string | null;
  checklistItemId?: string | null;
}

/**
 * Marca como resolvido o item (ou as observações) que deram origem à ordem de
 * serviço, e fecha o checklist inteiro se não sobrar mais nada pendente.
 *
 * Devolve o que foi feito, para a tela poder avisar o usuário. Nunca lança:
 * concluir a manutenção não pode falhar por causa do checklist.
 */
export async function resolveChecklistFromWorkOrder(
  record: LinkedRecord
): Promise<{ updated: boolean; checklistClosed: boolean }> {
  const nothing = { updated: false, checklistClosed: false };
  if (!record?.checklistId) return nothing;

  try {
    const ref = doc(db, "driverChecklists", record.checklistId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return nothing;

    const data = snap.data() as any;
    const updates: Record<string, unknown> = {};

    if (record.checklistItemId) {
      const resolved: string[] = data.resolvedItems || [];
      if (resolved.includes(record.checklistItemId)) return nothing; // já estava resolvido
      updates.resolvedItems = [...resolved, record.checklistItemId];
    } else {
      // WO aberta a partir do campo livre de observações
      if (data.issuesResolved) return nothing;
      updates.issuesResolved = true;
    }

    // Com esta resolução, sobrou algo pendente no checklist?
    const merged = { ...data, ...updates } as any;
    const items: ChecklistItemLike[] = merged.checklist || [];
    const resolvedItems: string[] = merged.resolvedItems || [];
    const hasOpenItems = items.some(
      (i) => itemState(i) !== "ok" && !resolvedItems.includes(i.id)
    );
    const hasOpenIssues = Boolean(merged.issues) && !merged.issuesResolved;

    let checklistClosed = false;
    if (!hasOpenItems && !hasOpenIssues && merged.status !== "resolved") {
      updates.status = "resolved";
      updates.resolvedAt = new Date().toISOString();
      // Fica registrado que quem encerrou foi a conclusão de uma ordem, e por
      // qual usuário — para responder "quem aprovou isso?" meses depois.
      updates.resolvedBy = auth.currentUser?.email || "";
      checklistClosed = true;
    }

    await updateDoc(ref, updates);
    return { updated: true, checklistClosed };
  } catch (err) {
    console.error("Could not resolve the linked checklist item:", err);
    return nothing;
  }
}

/**
 * Apagar a ordem de serviço solta o item do checklist.
 *
 * Sem isto, o item ficava marcado com o número de uma ordem que não existe
 * mais e o botão "Create WO" sumia — não dava para abrir outra ordem para
 * aquele problema sem mexer no banco na mão. O que já tiver sido marcado como
 * resolvido continua resolvido: aqui só se apaga a referência à ordem.
 */
export async function clearWorkOrderLink(record: LinkedRecord): Promise<boolean> {
  if (!record?.checklistId) return false;
  try {
    const ref = doc(db, "driverChecklists", record.checklistId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as any;

    if (record.checklistItemId) {
      const items = (data.checklist || []) as any[];
      let touched = false;
      const updated = items.map((i) => {
        if (i.id !== record.checklistItemId || !i.woCreated) return i;
        touched = true;
        const { woCreated, woId, woNumber, ...rest } = i;
        return rest;
      });
      if (!touched) return false;
      await updateDoc(ref, { checklist: updated });
      return true;
    }

    if (!data.issuesWoNumber) return false;
    await updateDoc(ref, { issuesWoNumber: deleteField() });
    return true;
  } catch (err) {
    console.error("Could not release the checklist item:", err);
    return false;
  }
}
