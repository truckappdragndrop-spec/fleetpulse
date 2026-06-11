import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  findAllMaintenance,
  findMaintenanceById,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  getOverdueMaintenance,
  getPendingMaintenanceCount,
  getMaintenanceCostByMonth,
} from "./queries/maintenance";

export const maintenanceRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        truckId: z.number().optional(),
        status: z.string().optional(),
      }).optional()
    )
    .query(({ input }) =>
      findAllMaintenance(input?.truckId, input?.status)
    ),

  byId: authedQuery
    .input(z.number())
    .query(({ input }) => findMaintenanceById(input)),

  create: authedQuery
    .input(
      z.object({
        truckId: z.number(),
        maintenanceType: z.enum([
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
        ]),
        title: z.string().min(1),
        description: z.string().optional(),
        scheduledDate: z.string(),
        scheduledKm: z.string().optional(),
        cost: z.string().optional(),
        provider: z.string().optional(),
        status: z
          .enum(["pending", "in_progress", "completed", "overdue", "cancelled"])
          .optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      })
    )
    .mutation(({ input }) => createMaintenance(input)),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          truckId: z.number().optional(),
          maintenanceType: z
            .enum([
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
            ])
            .optional(),
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          scheduledDate: z.string().optional(),
          completedDate: z.string().nullable().optional(),
          scheduledKm: z.string().nullable().optional(),
          actualKm: z.string().nullable().optional(),
          cost: z.string().nullable().optional(),
          provider: z.string().optional(),
          status: z
            .enum(["pending", "in_progress", "completed", "overdue", "cancelled"])
            .optional(),
          priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        }),
      })
    )
    .mutation(({ input }) => updateMaintenance(input.id, input.data)),

  delete: authedQuery
    .input(z.number())
    .mutation(({ input }) => deleteMaintenance(input)),

  overdue: authedQuery.query(() => getOverdueMaintenance()),

  pendingCount: authedQuery.query(() => getPendingMaintenanceCount()),

  costByMonth: authedQuery.query(() => getMaintenanceCostByMonth()),
});
