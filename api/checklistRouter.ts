import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  findAllChecklists,
  findChecklistById,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  getTodayChecklistStats,
  getChecklistTrends,
} from "./queries/checklists";

export const checklistRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        truckId: z.number().optional(),
        date: z.string().optional(),
      }).optional()
    )
    .query(({ input }) => findAllChecklists(input?.truckId, input?.date)),

  byId: authedQuery
    .input(z.number())
    .query(({ input }) => findChecklistById(input)),

  create: authedQuery
    .input(
      z.object({
        truckId: z.number(),
        driverName: z.string().min(1),
        checklistDate: z.string(),
        shift: z.enum(["morning", "afternoon", "night"]),
        kmAtStart: z.string().optional(),
        kmAtEnd: z.string().optional(),
        tiresOk: z.boolean().optional(),
        brakesOk: z.boolean().optional(),
        lightsOk: z.boolean().optional(),
        oilLevelOk: z.boolean().optional(),
        coolantLevelOk: z.boolean().optional(),
        wipersOk: z.boolean().optional(),
        hornOk: z.boolean().optional(),
        mirrorsOk: z.boolean().optional(),
        seatbeltOk: z.boolean().optional(),
        fireExtinguisherOk: z.boolean().optional(),
        emergencyKitOk: z.boolean().optional(),
        documentsOk: z.boolean().optional(),
        observations: z.string().optional(),
        issuesFound: z.boolean().optional(),
        issuesDescription: z.string().optional(),
        status: z.enum(["completed", "incomplete", "issues_reported"]).optional(),
      })
    )
    .mutation(({ input }) => createChecklist(input)),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          driverName: z.string().min(1).optional(),
          shift: z.enum(["morning", "afternoon", "night"]).optional(),
          kmAtStart: z.string().nullable().optional(),
          kmAtEnd: z.string().nullable().optional(),
          tiresOk: z.boolean().optional(),
          brakesOk: z.boolean().optional(),
          lightsOk: z.boolean().optional(),
          oilLevelOk: z.boolean().optional(),
          coolantLevelOk: z.boolean().optional(),
          wipersOk: z.boolean().optional(),
          hornOk: z.boolean().optional(),
          mirrorsOk: z.boolean().optional(),
          seatbeltOk: z.boolean().optional(),
          fireExtinguisherOk: z.boolean().optional(),
          emergencyKitOk: z.boolean().optional(),
          documentsOk: z.boolean().optional(),
          observations: z.string().optional(),
          issuesFound: z.boolean().optional(),
          issuesDescription: z.string().optional(),
          status: z.enum(["completed", "incomplete", "issues_reported"]).optional(),
        }),
      })
    )
    .mutation(({ input }) => updateChecklist(input.id, input.data)),

  delete: authedQuery
    .input(z.number())
    .mutation(({ input }) => deleteChecklist(input)),

  todayStats: authedQuery.query(() => getTodayChecklistStats()),

  trends: authedQuery
    .input(z.object({ days: z.number().optional() }).optional())
    .query(({ input }) => getChecklistTrends(input?.days ?? 7)),
});
