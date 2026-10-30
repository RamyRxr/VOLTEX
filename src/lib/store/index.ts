import { createMemoryRepo, emptyDb } from "./memory";
import { seedDemo } from "./seed";
import type { Repo } from "./types";

/**
 * The process-wide repository. Today: in memory, seeded on first use.
 * To move to Neon, return a Prisma-backed Repo here; services do not change.
 * Kept on globalThis so route handlers and server components share one store.
 */
const holder = globalThis as typeof globalThis & { __tensioRepo?: Promise<Repo> };

async function buildDemoRepo(): Promise<Repo> {
  const repo = createMemoryRepo(emptyDb());
  await seedDemo(repo, new Date());
  return repo;
}

function remember(pending: Promise<Repo>): Promise<Repo> {
  holder.__tensioRepo = pending.catch((error: unknown) => {
    holder.__tensioRepo = undefined;
    throw error;
  });
  return holder.__tensioRepo;
}

export function getRepo(): Promise<Repo> {
  return holder.__tensioRepo ?? remember(buildDemoRepo());
}

/** Rehearsals: rebuild the demo data relative to now. */
export async function resetDemoData(): Promise<void> {
  await remember(buildDemoRepo());
}
