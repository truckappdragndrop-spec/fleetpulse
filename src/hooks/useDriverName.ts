import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Busca o nome do motorista na coleção "users" do Firestore.
// Aceita o campo "name" ou "Name". Se não tiver, usa o displayName ou o email.
export function useDriverName(): string {
  const [name, setName] = useState(
    auth.currentUser?.displayName || auth.currentUser?.email || ""
  );

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "users", uid))
      .then((snap) => {
        const data = snap.data();
        const driverName = data?.name || data?.Name;
        if (driverName) setName(driverName);
      })
      .catch(() => {});
  }, []);

  return name;
}
