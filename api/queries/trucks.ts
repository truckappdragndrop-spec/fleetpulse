import { getDb } from "./connection";
import { trucks } from "@db/schema";
import { eq, desc, like, or, and } from "drizzle-orm";
import type { InsertTruck } from "@db/schema";

export async function findAllTrucks(search?: string, status?: string) {
  const db = getDb();
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        like(trucks.fleetId, `%${search}%`),
        like(trucks.plate, `%${search}%`),
        like(trucks.brand, `%${search}%`),
        like(trucks.model, `%${search}%`)
      )
    );
  }

  if (status) {
    conditions.push(eq(trucks.status, status as "active" | "maintenance" | "inactive" | "sold"));
  }

  if (conditions.length > 0) {
    return db.select().from(trucks).where(and(...conditions)).orderBy(desc(trucks.createdAt));
  }

  return db.select().from(trucks).orderBy(desc(trucks.createdAt));
}

export async function findTruckById(id: number) {
  const db = getDb();
  const result = await db.select().from(trucks).where(eq(trucks.id, id)).limit(1);
  return result[0] || null;
}

export async function findTruckByFleetId(fleetId: string) {
  const db = getDb();
  const result = await db.select().from(trucks).where(eq(trucks.fleetId, fleetId)).limit(1);
  return result[0] || null;
}

export async function createTruck(data: InsertTruck) {
  const db = getDb();
  const [result] = await db.insert(trucks).values(data).$returningId();
  return findTruckById(result.id);
}

export async function updateTruck(id: number, data: Partial<InsertTruck>) {
  const db = getDb();
  await db.update(trucks).set(data).where(eq(trucks.id, id));
  return findTruckById(id);
}

export async function deleteTruck(id: number) {
  const db = getDb();
  await db.delete(trucks).where(eq(trucks.id, id));
  return { id };
}

export async function getTruckStats() {
  const db = getDb();
  const allTrucks = await db.select().from(trucks);
  const activeCount = allTrucks.filter((t) => t.status === "active").length;
  const maintenanceCount = allTrucks.filter((t) => t.status === "maintenance").length;
  const inactiveCount = allTrucks.filter((t) => t.status === "inactive").length;
  return {
    total: allTrucks.length,
    active: activeCount,
    maintenance: maintenanceCount,
    inactive: inactiveCount,
  };
}
