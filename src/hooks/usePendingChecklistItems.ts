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
}

export function usePendingChecklistItems(driverEmail: string, truckId?: string) {
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverEmail) return;

    const loadPending = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "driverChecklists"),
          where("driverEmail", "==", driverEmail),
          where("status", "in", ["needs_review", "resolved"]),
          orderBy("submittedAt", "desc"),
          limit(10)
        );

        const snap = await getDocs(q);
        const items: PendingItem[] = [];

        snap.docs.forEach(doc => {
          const data = doc.data();
          if (truckId && data.truckId !== truckId) return;

          const resolvedItems = data.resolvedItems || [];
          const checklist = data.checklist || [];

          checklist.forEach((item: any) => {
            const state = item.status || (item.checked ? "ok" : "bad");
            if ((state === "fair" || state === "bad") && !resolvedItems.includes(item.id)) {
              items.push({
                id: item.id,
                label: item.label,
                labelPt: item.labelPt,
                status: state,
                notes: item.notes || "",
                photoUrl: item.photoUrl,
                reportId: doc.id,
                submittedAt: data.submittedAt,
                truckName: data.truckName || data.truckId,
              });
            }
          });
        });

        setPendingItems(items);
      } catch (err) {
        console.error("Error loading pending items:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPending();
  }, [driverEmail, truckId]);

  return { pendingItems, loading };
}
