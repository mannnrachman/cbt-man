import { ensureSeedServer } from "@/lib/server/repos/functions";
import { hydrateRepos, invalidateReposCache } from "./repos";

export async function ensureSeed(): Promise<void> {
  await ensureSeedServer();
  invalidateReposCache();
  await hydrateRepos();
}
