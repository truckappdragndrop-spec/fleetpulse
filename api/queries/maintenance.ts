import { getDb } from "./connection";
import { maintenanceRecords, trucks } from "@db/schema";
import { eq, desc, and, lte, sql } from "drizzle-orm";
import type { InsertMaintenanceRecord } from "@db/schema";

const maintenanceColumns = {
  id: maintenanceRecords.id,
  truckId: maintenanceRecords.truckId,
  maintenanceType: maintenanceRecords.maintenanceType,
  title: maintenanceRecords.title,
  description: maintenanceRecords.description,
  scheduledDate: maintenanceRecords.scheduledDate,
  completedDate: maintenanceRecords.completedDate,
  scheduledKm: maintenanceRecords.scheduledKm,
  actualKm: maintenanceRecords.actualKm,
  cost: maintenanceRecords.cost,
  provider: maintenanceRecords.provider,
  status: maintenanceRecords.status,
  priority: maintenanceRecords.priority,
  createdAt: maintenanceRecords.createdAt,
  updatedAt: maintenanceRecords.updatedAt,
};

const truckColumns = {
  fleetId: trucks.fleetId,
  truckBrand: trucks.brand,
  truckModel: trucks.model,
  truckPlate: trucks.plate,
};

export async function findAllMaintenance(truckId?: number, status?: string) {
  const db = getDb();
  const conditions = [];

  if (truckId) {
    conditions.push(eq(maintenanceRecords.truckId, truckId));
  }
  if (status) {
    conditions.push(eq(maintenanceRecords.status, status as "pending" | "in_progress" | "completed" | "overdue" | "cancelled"));
  }

  if (conditions.length > 0) {
    return db
      .select({ ...maintenanceColumns, ...truckColumns })
      .from(maintenanceRecords)
      .leftJoin(trucks, eq(maintenanceRecords.truckId, trucks.id))
      .where(and(...conditions))
      .orderBy(desc(maintenanceRecords.scheduledDate));
  }

  return db
    .select({ ...maintenanceColumns, ...truckColumns })
    .from(maintenanceRecords)
    .leftJoin(trucks, eq(maintenanceRecords.truckId, trucks.id))
    .orderBy(desc(maintenanceRecords.scheduledDate));
}

export async function findMaintenanceById(id: number) {
  const db = getDb();
  const result = await db
    .select({ ...maintenanceColumns, ...truckColumns })
    .from(maintenanceRecords)
    .leftJoin(trucks, eq(maintenanceRecords.truckId, trucks.id))
    .where(eq(maintenanceRecords.id, id))
    .limit(1);
  return result[0] || null;
}

export async function createMaintenance(data: InsertMaintenanceRecord) {
  const db = getDb();
  const [result] = await db.insert(maintenanceRecords).values(data).$returningId();
  return findMaintenanceById(result.id);
}

export async function updateMaintenance(id: number, data: Partial<InsertMaintenanceRecord>) {
  const db = getDb();
  await db.update(maintenanceRecords).set(data).where(eq(maintenanceRecords.id, id));
  return findMaintenanceById(id);
}

export async function deleteMaintenance(id: number) {
  const db = getDb();
  await db.delete(maintenanceRecords).where(eq(maintenanceRecords.id, id));
  return { id };
}

export async function getOverdueMaintenance() {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  return db
    .select({ ...maintenanceColumns, ...truckColumns })
    .from(maintenanceRecords)
    .leftJoin(trucks, eq(maintenanceRecords.truckId, trucks.id))
    .where(and(
      eq(maintenanceRecords.status, "pending"),
      lte(maintenanceRecords.scheduledDate, today)
    ))
    .orderBy(maintenanceRecords.scheduledDate);
}

export async function getPendingMaintenanceCount() {
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(maintenanceRecords)
    .where(eq(maintenanceRecords.status, "pending"));
  return result[0]?.count ?? 0;
}

export async function getMaintenanceCostByMonth() {
  const db = getDb();
  return db
    .select({
      month: sql<string>`DATE_FORMAT(STR_TO_DATE(${maintenanceRecords.completedDate}, '%Y-%m-%d'), '%Y-%m')`,
      totalCost: sql<number>`COALESCE(SUM(${maintenanceRecords.cost}), 0)`,
    })
    .from(maintenanceRecords)
    .where(eq(maintenanceRecords.status, "completed"))
    .groupBy(sql`DATE_FORMAT(STR_TO_DATE(${maintenanceRecords.completedDate}, '%Y-%m-%d'), '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(STR_TO_DATE(${maintenanceRecords.completedDate}, '%Y-%m-%d'), '%Y-%m')`);
}
