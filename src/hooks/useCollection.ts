import { useState, useEffect, useCallback } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface BaseDoc {
  id?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Escuta uma coleção do Firestore em tempo real, ordenada da mais recente
 * para a mais antiga.
 *
 * Nota sobre uma armadilha que existia aqui: o hook aceitava uma lista de
 * `constraints` (filtros) e usava `JSON.stringify(constraints)` como
 * dependência do useEffect. Objetos de filtro do Firestore não têm
 * representação em JSON — todos viram `{}` — então dois filtros diferentes
 * geravam a mesma dependência e a consulta não era refeita ao trocar o filtro.
 * Como nenhuma tela chegou a usar esse parâmetro, ele foi removido em vez de
 * remendado. Se um dia for preciso filtrar no servidor, o caminho é escrever
 * um hook específico para aquela consulta, com dependências que o React
 * consiga comparar de verdade (textos, números).
 */
export function useCollection<T extends BaseDoc>(collectionName: string) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as T),
          id: docSnap.id,
        }));
        setData(docs);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [collectionName]);

  const create = useCallback(
    async (item: Omit<T, "id" | "createdAt" | "updatedAt">) => {
      const now = Timestamp.now();
      const docRef = await addDoc(collection(db, collectionName), {
        ...item,
        createdAt: now,
        updatedAt: now,
      });
      return docRef.id;
    },
    [collectionName]
  );

  const update = useCallback(
    async (id: string, item: Partial<T>) => {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...item,
        updatedAt: Timestamp.now(),
      });
    },
    [collectionName]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, collectionName, id));
    },
    [collectionName]
  );

  return { data, isLoading, error, create, update, remove };
}
