import type { Context } from "../context";

export function createRouter(_ctx: Context) {
  return {
    healthCheck: async () => {
      return {
        status: 200 as const,
        body: "OK" as const,
      };
    },
  };
}

export type AppRouter = ReturnType<typeof createRouter>;
