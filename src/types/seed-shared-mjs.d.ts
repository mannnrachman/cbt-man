declare module "@/lib/server/db/seed-shared.mjs" {
	export type SeedDataset = {
		groups: Array<Record<string, unknown>>;
		users: Array<Record<string, unknown>>;
		modul: Array<Record<string, unknown>>;
		topik: Array<Record<string, unknown>>;
		soal: Array<Record<string, unknown>>;
		ujian: Array<Record<string, unknown>>;
		token: Array<Record<string, unknown>>;
		sesi: Array<Record<string, unknown>>;
		config: Record<string, unknown>;
	};

	export function createSeedDataset(args: {
		uid: (prefix?: string) => string;
		now: number;
		hashPassword: (password: string) => Promise<string>;
	}): Promise<SeedDataset>;

	export function seedDatabase(args: {
		prisma: unknown;
		dataset: SeedDataset;
		stringifyJson: (value: unknown) => string;
	}): Promise<void>;
}
