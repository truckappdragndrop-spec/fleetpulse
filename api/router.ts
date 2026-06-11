import { authRouter } from "./auth-router";
import { truckRouter } from "./truckRouter";
import { maintenanceRouter } from "./maintenanceRouter";
import { fuelRouter } from "./fuelRouter";
import { checklistRouter } from "./checklistRouter";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  truck: truckRouter,
  maintenance: maintenanceRouter,
  fuel: fuelRouter,
  checklist: checklistRouter,
});

export type AppRouter = typeof appRouter;
