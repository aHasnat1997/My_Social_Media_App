import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const contract = c.router({
  healthCheck: {
    method: "GET",
    path: "/health",
    responses: {
      200: z.literal("OK"),
    },
  },
});

export type AppContract = typeof contract;
