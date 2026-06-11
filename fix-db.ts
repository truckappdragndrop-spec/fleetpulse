import { getDb } from "./api/queries/connection";
import { sql } from "drizzle-orm";

async function fix() {
  const db = getDb();
  const tables = [
    ["maintenance_records", "scheduledDate", false],
    ["maintenance_records", "completedDate", true],
    ["fuel_records", "fuelDate", false],
    ["driver_checklists", "checklistDate", false],
    ["trucks", "lastMaintenanceDate", true],
    ["trucks", "nextMaintenanceDate", true],
  ] as const;

  for (const [table, col, nullable] of tables) {
    try {
      await db.execute(
        sql.raw(`ALTER TABLE ${table} MODIFY ${col} VARCHAR(20)${nullable ? "" : " NOT NULL"}`)
      );
      console.log(`fixed ${table}.${col}`);
    } catch (e: any) {
      console.log(`skip ${table}.${col}: ${e.message}`);
    }
  }
}

fix().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
