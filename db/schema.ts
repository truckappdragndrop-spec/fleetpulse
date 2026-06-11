import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  decimal,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── Users (auth) ──────────────────────────────────────────
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Trucks ────────────────────────────────────────────────
export const trucks = mysqlTable("trucks", {
  id: serial("id").primaryKey(),
  fleetId: varchar("fleetId", { length: 50 }).notNull().unique(),
  plate: varchar("plate", { length: 20 }).notNull().unique(),
  brand: varchar("brand", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  year: int("year").notNull(),
  color: varchar("color", { length: 50 }),
  chassisNumber: varchar("chassisNumber", { length: 100 }),
  engineNumber: varchar("engineNumber", { length: 100 }),
  currentKm: decimal("currentKm", { precision: 12, scale: 1 }).notNull().default("0"),
  fuelTankCapacity: int("fuelTankCapacity").default(0),
  status: mysqlEnum("status", [
    "active",
    "maintenance",
    "inactive",
    "sold",
  ])
    .default("active")
    .notNull(),
  lastMaintenanceDate: varchar("lastMaintenanceDate", { length: 20 }),
  nextMaintenanceDate: varchar("nextMaintenanceDate", { length: 20 }),
  nextMaintenanceKm: decimal("nextMaintenanceKm", { precision: 12, scale: 1 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Truck = typeof trucks.$inferSelect;
export type InsertTruck = typeof trucks.$inferInsert;

// ─── Maintenance Records ───────────────────────────────────
export const maintenanceRecords = mysqlTable("maintenance_records", {
  id: serial("id").primaryKey(),
  truckId: bigint("truckId", { mode: "number", unsigned: true }).notNull(),
  maintenanceType: mysqlEnum("maintenanceType", [
    "oil_change",
    "tire_inspection",
    "brake_check",
    "engine_tuneup",
    "filter_replacement",
    "electrical",
    "suspension",
    "transmission",
    "cooling_system",
    "other",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  scheduledDate: varchar("scheduledDate", { length: 20 }).notNull(),
  completedDate: varchar("completedDate", { length: 20 }),
  scheduledKm: decimal("scheduledKm", { precision: 12, scale: 1 }),
  actualKm: decimal("actualKm", { precision: 12, scale: 1 }),
  cost: decimal("cost", { precision: 12, scale: 2 }).default("0"),
  provider: varchar("provider", { length: 255 }),
  status: mysqlEnum("status", [
    "pending",
    "in_progress",
    "completed",
    "overdue",
    "cancelled",
  ])
    .default("pending")
    .notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"])
    .default("medium")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;
export type InsertMaintenanceRecord = typeof maintenanceRecords.$inferInsert;

// ─── Fuel Records ──────────────────────────────────────────
export const fuelRecords = mysqlTable("fuel_records", {
  id: serial("id").primaryKey(),
  truckId: bigint("truckId", { mode: "number", unsigned: true }).notNull(),
  driverName: varchar("driverName", { length: 255 }),
  fuelDate: varchar("fuelDate", { length: 20 }).notNull(),
  liters: decimal("liters", { precision: 10, scale: 2 }).notNull(),
  pricePerLiter: decimal("pricePerLiter", { precision: 8, scale: 2 }),
  totalCost: decimal("totalCost", { precision: 10, scale: 2 }),
  kmAtRefuel: decimal("kmAtRefuel", { precision: 12, scale: 1 }),
  kmPrevious: decimal("kmPrevious", { precision: 12, scale: 1 }),
  kmDriven: decimal("kmDriven", { precision: 12, scale: 1 }),
  efficiency: decimal("efficiency", { precision: 6, scale: 2 }),
  stationName: varchar("stationName", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FuelRecord = typeof fuelRecords.$inferSelect;
export type InsertFuelRecord = typeof fuelRecords.$inferInsert;

// ─── Driver Checklists ─────────────────────────────────────
export const driverChecklists = mysqlTable("driver_checklists", {
  id: serial("id").primaryKey(),
  truckId: bigint("truckId", { mode: "number", unsigned: true }).notNull(),
  driverName: varchar("driverName", { length: 255 }).notNull(),
  checklistDate: varchar("checklistDate", { length: 20 }).notNull(),
  shift: mysqlEnum("shift", ["morning", "afternoon", "night"]).notNull(),
  kmAtStart: decimal("kmAtStart", { precision: 12, scale: 1 }),
  kmAtEnd: decimal("kmAtEnd", { precision: 12, scale: 1 }),

  // Vehicle condition checks
  tiresOk: boolean("tiresOk").default(true),
  brakesOk: boolean("brakesOk").default(true),
  lightsOk: boolean("lightsOk").default(true),
  oilLevelOk: boolean("oilLevelOk").default(true),
  coolantLevelOk: boolean("coolantLevelOk").default(true),
  wipersOk: boolean("wipersOk").default(true),
  hornOk: boolean("hornOk").default(true),
  mirrorsOk: boolean("mirrorsOk").default(true),
  seatbeltOk: boolean("seatbeltOk").default(true),
  fireExtinguisherOk: boolean("fireExtinguisherOk").default(true),
  emergencyKitOk: boolean("emergencyKitOk").default(true),
  documentsOk: boolean("documentsOk").default(true),

  // Observations
  observations: text("observations"),
  issuesFound: boolean("issuesFound").default(false),
  issuesDescription: text("issuesDescription"),

  status: mysqlEnum("status", ["completed", "incomplete", "issues_reported"])
    .default("completed")
    .notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DriverChecklist = typeof driverChecklists.$inferSelect;
export type InsertDriverChecklist = typeof driverChecklists.$inferInsert;
