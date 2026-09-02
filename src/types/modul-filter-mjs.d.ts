declare module "@/lib/cbt/modul-filter.mjs" {
	export function filterModuls<T extends { nama: string }>(
		moduls: T[],
		query: string,
	): T[];
}
