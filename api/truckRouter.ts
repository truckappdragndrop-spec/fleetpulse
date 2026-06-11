import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  findAllTrucks,
  findTruckById,
  createTruck,
  updateTruck,
  deleteTruck,
  getTruckStats,
} from "./queries/trucks";

export const truckRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
      }).optional()
    )
    .query(({ input }) => findAllTrucks(input?.search, input?.status)),

  byId: authedQuery
    .input(z.number())
    .query(({ input }) => findTruckById(input)),

  create: authedQuery
    .input(
      z.object({
        fleetId: z.string().min(1),
        plate: z.string().min(1),
        brand: z.string().min(1),
        model: z.string().min(1),
        year: z.number().min(1950).max(2030),
        color: z.string().optional(),
        chassisNumber: z.string().optional(),
        engineNumber: z.string().optional(),
        currentKm: z.string().optional(),
        fuelTankCapacity: z.number().optional(),
        status: z.enum(["active", "maintenance", "inactive", "sold"]).optional(),
        lastMaintenanceDate: z.string().optional(),
        nextMaintenanceDate: z.string().optional(),
        nextMaintenanceKm: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ input }) => createTruck(input)),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          fleetId: z.string().min(1).optional(),
          plate: z.string().min(1).optional(),
          brand: z.string().min(1).optional(),
          model: z.string().min(1).optional(),
          year: z.number().min(1950).max(2030).optional(),
          color: z.string().optional(),
          chassisNumber: z.string().optional(),
          engineNumber: z.string().optional(),
          currentKm: z.string().optional(),
          fuelTankCapacity: z.number().optional(),
          status: z.enum(["active", "maintenance", "inactive", "sold"]).optional(),
          lastMaintenanceDate: z.string().nullable().optional(),
          nextMaintenanceDate: z.string().nullable().optional(),
          nextMaintenanceKm: z.string().nullable().optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(({ input }) => updateTruck(input.id, input.data)),

  delete: authedQuery
    .input(z.number())
    .mutation(({ input }) => deleteTruck(input)),

  stats: authedQuery.query(() => getTruckStats()),
});
