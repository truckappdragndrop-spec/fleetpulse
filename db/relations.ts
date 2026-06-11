import { relations } from "drizzle-orm";
import { trucks, maintenanceRecords, fuelRecords, driverChecklists } from "./schema";

export const trucksRelations = relations(trucks, ({ many }) => ({
  maintenanceRecords: many(maintenanceRecords),
  fuelRecords: many(fuelRecords),
  checklists: many(driverChecklists),
}));

export const maintenanceRecordsRelations = relations(maintenanceRecords, ({ one }) => ({
  truck: one(trucks, {
    fields: [maintenanceRecords.truckId],
    references: [trucks.id],
  }),
}));

export const fuelRecordsRelations = relations(fuelRecords, ({ one }) => ({
  truck: one(trucks, {
    fields: [fuelRecords.truckId],
    references: [trucks.id],
  }),
}));

export const driverChecklistsRelations = relations(driverChecklists, ({ one }) => ({
  truck: one(trucks, {
    fields: [driverChecklists.truckId],
    references: [trucks.id],
  }),
}));
