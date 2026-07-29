// This backend wires the API handlers directly, so the ts-rest context is a
// minimal placeholder. Extend it with whatever per-request data your routers need.
export type Context = Record<string, never>;

export function createContext(): Context {
  return {};
}
