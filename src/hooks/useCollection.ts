import { useState, useEffect, useCallback } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface BaseDoc {
  id?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function useCollection<T extends BaseDoc>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const baseConstraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
    const q = query(
      collection(db, collectionName),
      ...(constraints.length > 0 ? constraints : baseConstraints)
    );

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
  }, [collectionName, JSON.stringify(constraints)]);

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

export function whereFn(
  field: string,
  op: "==" | "!=" | "<" | "<=" | ">" | ">=" | "array-contains" | "in",
  value: unknown
) {
  return where(field, op, value);
}
