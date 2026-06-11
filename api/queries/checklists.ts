import { getDb } from "./connection";
import { driverChecklists, trucks } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import type { InsertDriverChecklist } from "@db/schema";

const checklistColumns = {
  id: driverChecklists.id,
  truckId: driverChecklists.truckId,
  driverName: driverChecklists.driverName,
  checklistDate: driverChecklists.checklistDate,
  shift: driverChecklists.shift,
  kmAtStart: driverChecklists.kmAtStart,
  kmAtEnd: driverChecklists.kmAtEnd,
  tiresOk: driverChecklists.tiresOk,
  brakesOk: driverChecklists.brakesOk,
  lightsOk: driverChecklists.lightsOk,
  oilLevelOk: driverChecklists.oilLevelOk,
  coolantLevelOk: driverChecklists.coolantLevelOk,
  wipersOk: driverChecklists.wipersOk,
  hornOk: driverChecklists.hornOk,
  mirrorsOk: driverChecklists.mirrorsOk,
  seatbeltOk: driverChecklists.seatbeltOk,
  fireExtinguisherOk: driverChecklists.fireExtinguisherOk,
  emergencyKitOk: driverChecklists.emergencyKitOk,
  documentsOk: driverChecklists.documentsOk,
  observations: driverChecklists.observations,
  issuesFound: driverChecklists.issuesFound,
  issuesDescription: driverChecklists.issuesDescription,
  status: driverChecklists.status,
  createdAt: driverChecklists.createdAt,
};

const truckColumns = {
  fleetId: trucks.fleetId,
  truckBrand: trucks.brand,
  truckModel: trucks.model,
  truckPlate: trucks.plate,
};

export async function findAllChecklists(truckId?: number, date?: string) {
  const db = getDb();
  const conditions = [];

  if (truckId) {
    conditions.push(eq(driverChecklists.truckId, truckId));
  }
  if (date) {
    conditions.push(eq(driverChecklists.checklistDate, date));
  }

  if (conditions.length > 0) {
    return db
      .select({ ...checklistColumns, ...truckColumns })
      .from(driverChecklists)
      .leftJoin(trucks, eq(driverChecklists.truckId, trucks.id))
      .where(and(...conditions))
      .orderBy(desc(driverChecklists.checklistDate));
  }

  return db
    .select({ ...checklistColumns, ...truckColumns })
    .from(driverChecklists)
    .leftJoin(trucks, eq(driverChecklists.truckId, trucks.id))
    .orderBy(desc(driverChecklists.checklistDate));
}

export async function findChecklistById(id: number) {
  const db = getDb();
  const result = await db
    .select({ ...checklistColumns, ...truckColumns })
    .from(driverChecklists)
    .leftJoin(trucks, eq(driverChecklists.truckId, trucks.id))
    .where(eq(driverChecklists.id, id))
    .limit(1);
  return result[0] || null;
}

export async function createChecklist(data: InsertDriverChecklist) {
  const db = getDb();
  const [result] = await db.insert(driverChecklists).values(data).$returningId();
  return findChecklistById(result.id);
}

export async function updateChecklist(id: number, data: Partial<InsertDriverChecklist>) {
  const db = getDb();
  await db.update(driverChecklists).set(data).where(eq(driverChecklists.id, id));
  return findChecklistById(id);
}

export async function deleteChecklist(id: number) {
  const db = getDb();
  await db.delete(driverChecklists).where(eq(driverChecklists.id, id));
  return { id };
}

export async function getTodayChecklistStats() {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];

  const allTrucks = await db.select().from(trucks).where(eq(trucks.status, "active"));
  const todayChecklists = await db
    .select()
    .from(driverChecklists)
    .where(eq(driverChecklists.checklistDate, today));

  const completedCount = todayChecklists.filter(
    (c) => c.status === "completed"
  ).length;
  const issuesCount = todayChecklists.filter(
    (c) => c.status === "issues_reported"
  ).length;

  return {
    totalTrucks: allTrucks.length,
    completed: completedCount,
    issues: issuesCount,
    completionRate: allTrucks.length > 0 ? Math.round((completedCount / allTrucks.length) * 100) : 0,
  };
}

export async function getChecklistTrends(days: number = 7) {
  const db = getDb();
  return db
    .select({
      date: driverChecklists.checklistDate,
      count: sql<number>`COUNT(*)`,
      issues: sql<number>`SUM(CASE WHEN ${driverChecklists.issuesFound} = true THEN 1 ELSE 0 END)`,
    })
    .from(driverChecklists)
    .groupBy(driverChecklists.checklistDate)
    .orderBy(desc(driverChecklists.checklistDate))
    .limit(days);
}
