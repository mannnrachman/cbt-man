import { realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function confirmedDemoDatabaseUrl(env, confirmedPath) {
  if (env.NODE_ENV !== "development") {
    throw new Error("Penyiapan demo memerlukan NODE_ENV=development secara eksplisit.");
  }
  if (!env.DATABASE_URL?.startsWith("file:/")) {
    throw new Error("DATABASE_URL harus menunjuk file SQLite lokal dengan path absolut.");
  }
  const url = new URL(env.DATABASE_URL);
  if (url.host || url.search || url.hash) {
    throw new Error("DATABASE_URL tidak boleh memiliki host, query, atau fragment.");
  }
  const target = realpathSync(fileURLToPath(url));
  if (!statSync(target).isFile()) throw new Error("Target database harus file yang sudah ada.");
  if (confirmedPath !== target) {
    throw new Error(`Periksa target development, lalu berikan --confirm-database dengan path sebenarnya: ${target}`);
  }
  const databaseUrl = `file:${target}`;
  if (fileURLToPath(databaseUrl) !== target) {
    throw new Error("Path database mengandung karakter URL yang ambigu.");
  }
  return databaseUrl;
}
