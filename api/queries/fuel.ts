import { getDb } from "./connection";
import { fuelRecords, trucks } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { InsertFuelRecord } from "@db/schema";

const fuelColumns = {
  id: fuelRecords.id,
  truckId: fuelRecords.truckId,
  driverName: fuelRecords.driverName,
  fuelDate: fuelRecords.fuelDate,
  liters: fuelRecords.liters,
  pricePerLiter: fuelRecords.pricePerLiter,
  totalCost: fuelRecords.totalCost,
  kmAtRefuel: fuelRecords.kmAtRefuel,
  kmPrevious: fuelRecords.kmPrevious,
  kmDriven: fuelRecords.kmDriven,
  efficiency: fuelRecords.efficiency,
  stationName: fuelRecords.stationName,
  notes: fuelRecords.notes,
  createdAt: fuelRecords.createdAt,
};

const truckColumns = {
  fleetId: trucks.fleetId,
  truckBrand: trucks.brand,
  truckModel: trucks.model,
  truckPlate: trucks.plate,
};

export async function findAllFuelRecords(truckId?: number) {
  const db = getDb();
  if (truckId) {
    return db
      .select({ ...fuelColumns, ...truckColumns })
      .from(fuelRecords)
      .leftJoin(trucks, eq(fuelRecords.truckId, trucks.id))
      .where(eq(fuelRecords.truckId, truckId))
      .orderBy(desc(fuelRecords.fuelDate));
  }

  return db
    .select({ ...fuelColumns, ...truckColumns })
    .from(fuelRecords)
    .leftJoin(trucks, eq(fuelRecords.truckId, trucks.id))
    .orderBy(desc(fuelRecords.fuelDate));
}

export async function findFuelRecordById(id: number) {
  const db = getDb();
  const result = await db
    .select({ ...fuelColumns, ...truckColumns })
    .from(fuelRecords)
    .leftJoin(trucks, eq(fuelRecords.truckId, trucks.id))
    .where(eq(fuelRecords.id, id))
    .limit(1);
  return result[0] || null;
}

export async function createFuelRecord(data: InsertFuelRecord) {
  const db = getDb();
  const [result] = await db.insert(fuelRecords).values(data).$returningId();
  return findFuelRecordById(result.id);
}

export async function updateFuelRecord(id: number, data: Partial<InsertFuelRecord>) {
  const db = getDb();
  await db.update(fuelRecords).set(data).where(eq(fuelRecords.id, id));
  return findFuelRecordById(id);
}

export async function deleteFuelRecord(id: number) {
  const db = getDb();
  await db.delete(fuelRecords).where(eq(fuelRecords.id, id));
  return { id };
}

export async function getFuelConsumptionByMonth() {
  const db = getDb();
  return db
    .select({
      month: sql<string>`SUBSTRING(${fuelRecords.fuelDate}, 1, 7)`,
      totalLiters: sql<number>`COALESCE(SUM(${fuelRecords.liters}), 0)`,
      totalCost: sql<number>`COALESCE(SUM(${fuelRecords.totalCost}), 0)`,
      avgEfficiency: sql<number>`COALESCE(AVG(${fuelRecords.efficiency}), 0)`,
    })
    .from(fuelRecords)
    .groupBy(sql`SUBSTRING(${fuelRecords.fuelDate}, 1, 7)`)
    .orderBy(sql`SUBSTRING(${fuelRecords.fuelDate}, 1, 7)`);
}

export async function getFuelConsumptionByTruck() {
  const db = getDb();
  return db
    .select({
      truckId: fuelRecords.truckId,
      fleetId: trucks.fleetId,
      truckBrand: trucks.brand,
      truckModel: trucks.model,
      totalLiters: sql<number>`COALESCE(SUM(${fuelRecords.liters}), 0)`,
      totalCost: sql<number>`COALESCE(SUM(${fuelRecords.totalCost}), 0)`,
      avgEfficiency: sql<number>`COALESCE(AVG(${fuelRecords.efficiency}), 0)`,
      recordCount: sql<number>`COUNT(*)`,
    })
    .from(fuelRecords)
    .leftJoin(trucks, eq(fuelRecords.truckId, trucks.id))
    .groupBy(fuelRecords.truckId, trucks.fleetId, trucks.brand, trucks.model)
    .orderBy(desc(sql`SUM(${fuelRecords.liters})`));
}
