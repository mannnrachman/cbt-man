import { prisma } from "./prisma";
import { parseJson } from "./json";
import { validateSession, readSessionToken } from "./session";
import type { NavKey, Ujian } from "@/lib/cbt/types";
import type { UserRow } from "../repos/mappers";
// @ts-expect-error -- seed helper is an untyped .mjs module

import { createSeedDataset, seedDatabase } from "./seed-shared.mjs";
import { hashPassword } from "@/lib/cbt/hash";
import { stringifyJson } from "./json";
import { uid } from "./id.server";

export type MutationAction = "upsert" | "remove" | "bulkSet";
export type MutationAuthResult = { ok: true } | { ok: false; error: string };

const OPERATOR_SESSION_KEYS: NavKey[] = [
	"ujian",
	"hasil",
	"evaluasi",
	"laporan",
	"leaderboard",
];

export function allowedTopikIdsForCaller(caller: UserRow): Set<string> | null {
	if (caller.role === "super_admin") return null;
	if (caller.role !== "admin_prodi" && caller.role !== "evaluator") return new Set();
	const topikIds = parseJson<string[]>(caller.allowedTopikIds, []);
	const mkIds = parseJson<string[]>(caller.mataKuliahIds || "[]", []);
	if (topikIds.length === 0 && mkIds.length === 0) return null; // unrestricted
	return new Set(topikIds);
}

export async function operatorAccessKeys(role: string): Promise<Set<NavKey>> {
	const config = await prisma.appConfig.findUnique({ where: { id: "app" } });
	const roleAccess = parseJson<Record<string, string[]>>(config?.roleAccess ?? "{}", {});
	return new Set((roleAccess[role] ?? []) as NavKey[]);
}

export async function operatorHasNav(caller: UserRow, key: NavKey): Promise<boolean> {
	if (caller.role !== "admin_prodi" && caller.role !== "evaluator") return false;
	const keys = await operatorAccessKeys(caller.role);
	return keys.has(key);
}

export async function operatorHasAnyNav(
	caller: UserRow,
	keys: NavKey[],
): Promise<boolean> {
	if (caller.role !== "admin_prodi" && caller.role !== "evaluator") return false;
	const allowed = await operatorAccessKeys(caller.role);
	return keys.some((key) => allowed.has(key));
}

export async function operatorCanTouchTopikId(caller: UserRow, topikId: string): Promise<boolean> {
	const allowed = allowedTopikIdsForCaller(caller);
	if (allowed === null) return true;
	if (allowed.has(topikId)) return true;

	const mkIds = parseJson<string[]>(caller.mataKuliahIds || "[]", []);
	if (mkIds.length > 0) {
		const topik = await prisma.topik.findUnique({
			where: { id: topikId },
			include: { modul: true },
		});
		if (topik?.modul?.mataKuliahId && mkIds.includes(topik.modul.mataKuliahId)) return true;
	}
	return false;
}

export async function operatorCanTouchTopicSets(
	caller: UserRow,
	topicSets: Ujian["topicSets"],
): Promise<boolean> {
	for (const item of topicSets) {
		if (!(await operatorCanTouchTopikId(caller, item.topikId))) return false;
	}
	return true;
}

export async function operatorCanTouchModul(
	caller: UserRow,
	modulId: string,
): Promise<boolean> {
	const allowed = allowedTopikIdsForCaller(caller);
	if (allowed === null) return true;
	
	const mkIds = parseJson<string[]>(caller.mataKuliahIds || "[]", []);
	if (mkIds.length > 0) {
		const modul = await prisma.modul.findUnique({ where: { id: modulId } });
		if (modul?.mataKuliahId && mkIds.includes(modul.mataKuliahId)) return true;
	}

	const count = await prisma.topik.count({
		where: { modulId, id: { in: [...allowed] } },
	});
	return count > 0;
}

export async function operatorCanTouchSoal(
	caller: UserRow,
	soalId: string,
): Promise<boolean> {
	const soal = await prisma.soal.findUnique({
		where: { id: soalId },
		select: { topikId: true },
	});
	return !!soal && (await operatorCanTouchTopikId(caller, soal.topikId));
}

export async function operatorCanTouchUjian(
	caller: UserRow,
	ujianId: string,
): Promise<boolean> {
	const ujian = await prisma.ujian.findUnique({
		where: { id: ujianId },
		select: { topicSets: true, mataKuliahId: true },
	});
	if (!ujian) return false;
	
	const mkIds = parseJson<string[]>(caller.mataKuliahIds || "[]", []);
	if (ujian.mataKuliahId && mkIds.includes(ujian.mataKuliahId)) return true;

	const topicSets = parseJson<Ujian["topicSets"]>(ujian.topicSets, []);
	return await operatorCanTouchTopicSets(caller, topicSets);
}

export async function pesertaCanTouchUjian(
	caller: UserRow,
	ujianId: string,
): Promise<boolean> {
	if (caller.role !== "mahasiswa") return false;
	const ujian = await prisma.ujian.findUnique({
		where: { id: ujianId },
		select: { groupIds: true },
	});
	if (!ujian) return false;
	const groupIds = parseJson<string[]>(ujian.groupIds, []);
	return (
		groupIds.length === 0 ||
		  (!!caller.unitId && groupIds.includes(caller.unitId))

	);
}

let seedPromise: Promise<void> | null = null;
export function seedIfNeeded(): Promise<void> {
	if (!seedPromise) {
		seedPromise = (async () => {
			const count = await prisma.user.count();
			if (count > 0) return;

			const dataset = await createSeedDataset({
				uid,
				now: Date.now(),
				hashPassword,
			});

			await seedDatabase({
				prisma,
				dataset,
				stringifyJson,
			});
		})().finally(() => {
			seedPromise = null;
		});
	}
	return seedPromise;
}

export async function requireCaller(): Promise<UserRow | null> {
	await seedIfNeeded();
	return validateSession(readSessionToken());
}

export async function requireAdminResult(): Promise<MutationAuthResult> {
	const caller = await requireCaller();
	if (!caller || caller.role !== "super_admin")
		return { ok: false, error: "Forbidden" };
	return { ok: true };
}
