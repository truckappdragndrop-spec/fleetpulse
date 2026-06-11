import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  findAllFuelRecords,
  findFuelRecordById,
  createFuelRecord,
  updateFuelRecord,
  deleteFuelRecord,
  getFuelConsumptionByMonth,
  getFuelConsumptionByTruck,
} from "./queries/fuel";

export const fuelRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        truckId: z.number().optional(),
      }).optional()
    )
    .query(({ input }) => findAllFuelRecords(input?.truckId)),

  byId: authedQuery
    .input(z.number())
    .query(({ input }) => findFuelRecordById(input)),

  create: authedQuery
    .input(
      z.object({
        truckId: z.number(),
        driverName: z.string().optional(),
        fuelDate: z.string(),
        liters: z.string(),
        pricePerLiter: z.string().optional(),
        totalCost: z.string().optional(),
        kmAtRefuel: z.string().optional(),
        kmPrevious: z.string().optional(),
        kmDriven: z.string().optional(),
        efficiency: z.string().optional(),
        stationName: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ input }) => createFuelRecord(input)),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          driverName: z.string().optional(),
          fuelDate: z.string().optional(),
          liters: z.string().optional(),
          pricePerLiter: z.string().nullable().optional(),
          totalCost: z.string().nullable().optional(),
          kmAtRefuel: z.string().nullable().optional(),
          kmPrevious: z.string().nullable().optional(),
          kmDriven: z.string().nullable().optional(),
          efficiency: z.string().nullable().optional(),
          stationName: z.string().optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(({ input }) => updateFuelRecord(input.id, input.data)),

  delete: authedQuery
    .input(z.number())
    .mutation(({ input }) => deleteFuelRecord(input)),

  consumptionByMonth: authedQuery.query(() => getFuelConsumptionByMonth()),

  consumptionByTruck: authedQuery.query(() => getFuelConsumptionByTruck()),
});
