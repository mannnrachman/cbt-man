/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/server/db/prisma";
import { parseJson } from "@/lib/server/db/json";
import { 
	Snapshot, 
	SnapshotRows, 
	UserRow, 
	publicUser, 
	mapSoal, 
	mapUjian, 
	mapToken, 
	mapSesi, 
	buildConfig 
} from "./mappers";

export async function loadSnapshotRows(): Promise<SnapshotRows> {
		const [
			users, unitAkademik, tahunAkademik, semester, mataKuliah,
			modul, topik, soal,
			ujian, token, sesi, config
		] = await Promise.all([
			prisma.user.findMany({ include: { createdUjians: false } }),
			prisma.unitAkademik.findMany({ orderBy: { nama: "asc" } }),

			prisma.tahunAkademik.findMany({ orderBy: { nama: "asc" } }),
			prisma.semester.findMany({ orderBy: { nama: "asc" } }),
			prisma.mataKuliah.findMany({ orderBy: { nama: "asc" } }),
			prisma.modul.findMany({ orderBy: { nama: "asc" } }),
			prisma.topik.findMany({ orderBy: { nama: "asc" } }),
			prisma.soal.findMany({
				include: { jawaban: true },
				orderBy: { createdAt: "asc" },
			}),
			prisma.ujian.findMany({ orderBy: { createdAt: "asc" } }),
			prisma.tokenUjian.findMany({ orderBy: { kode: "asc" } }),
			prisma.sesiUjian.findMany({ orderBy: { createdAt: "asc" } }),
			prisma.appConfig.findUnique({ where: { id: "app" } }),
		]);

	return { 
		users, 
		unitAkademik: unitAkademik as any,
		tahunAkademik, semester, 
		mataKuliah: mataKuliah.map(m => ({ ...m, unitId: m.unitId ?? undefined, semesterId: m.semesterId ?? undefined })),

		modul: modul.map(m => ({ ...m, mataKuliahId: m.mataKuliahId ?? undefined })), 
		topik, soal, ujian, token, sesi, config 
	};
}

export function adminSnapshot(rows: SnapshotRows): Snapshot {
	return {
		users: rows.users.map(publicUser),
		unitAkademik: rows.unitAkademik as any,

		tahunAkademik: rows.tahunAkademik,
		semester: rows.semester,
		mataKuliah: rows.mataKuliah,
		modul: rows.modul,
		topik: rows.topik,
		soal: rows.soal.map(mapSoal),
		ujian: rows.ujian.map(mapUjian),
		token: rows.token.map(mapToken),
		sesi: rows.sesi.map(mapSesi),
		config: buildConfig(rows.config),
	};
}

export function operatorSnapshot(rows: SnapshotRows, caller: UserRow): Snapshot {
	const parsedAllowedTopikIds = parseJson<string[]>(caller.allowedTopikIds, []);
	const unrestricted = parsedAllowedTopikIds.length === 0;
	const allowedTopikIds = unrestricted ? null : new Set(parsedAllowedTopikIds);
	const topik = allowedTopikIds
		? rows.topik.filter((item) => allowedTopikIds.has(item.id))
		: rows.topik;
	const topikIds = new Set(topik.map((item) => item.id));
	const modulIds = new Set(topik.map((item) => item.modulId));
	const modul = unrestricted
		? rows.modul
		: rows.modul.filter((item) => modulIds.has(item.id));
	const soal = unrestricted
		? rows.soal
		: rows.soal.filter((item) => topikIds.has(item.topikId));
	const ujian = unrestricted
		? rows.ujian
		: rows.ujian.filter((item) =>
				parseJson<{ topikId: string }[]>(item.topicSets, []).some((set) =>
					topikIds.has(set.topikId),
				),
			);
	const ujianIds = new Set(ujian.map((item) => item.id));
	const sesi = rows.sesi.filter((item) => ujianIds.has(item.ujianId));
	const token = rows.token.filter((item) => ujianIds.has(item.ujianId));
	const visibleUnitIds = new Set(

		ujian.flatMap((item) => parseJson<string[]>(item.groupIds, [])),
	);
	const visiblePesertaIds = new Set(sesi.map((item) => item.pesertaId));
	const includeAllPeserta = ujian.some(
		(item) => parseJson<string[]>(item.groupIds, []).length === 0,
	);
	const users = rows.users.filter((item) => {
		if (item.id === caller.id) return true;
		if (item.role !== "mahasiswa") return false;
		if (includeAllPeserta) return true;
		if (visiblePesertaIds.has(item.id)) return true;
		return item.unitId ? visibleUnitIds.has(item.unitId) : false;

	});

	return {
		users: users.map(publicUser),
		unitAkademik: rows.unitAkademik as any,

		tahunAkademik: rows.tahunAkademik,
		semester: rows.semester,
		mataKuliah: rows.mataKuliah,
		modul,
		topik,
		soal: soal.map(mapSoal),
		ujian: ujian.map(mapUjian),
		token: token.map(mapToken),
		sesi: sesi.map(mapSesi),
		config: buildConfig(rows.config),
	};
}

export function pesertaSnapshot(rows: SnapshotRows, caller: UserRow): Snapshot {
	const ujian = rows.ujian.filter((item) => {
		const groupIds = parseJson<string[]>(item.groupIds, []);
		return (
			groupIds.length === 0 ||
			(!!caller.unitId && groupIds.includes(caller.unitId))

		);
	});
	const ujianIds = new Set(ujian.map((item) => item.id));
	const sesi = rows.sesi.filter(
		(item) => item.pesertaId === caller.id && ujianIds.has(item.ujianId),
	);
	const soalIds = new Set(
		sesi.flatMap((item) => parseJson<string[]>(item.soalIds, [])),
	);
	const soal = rows.soal.filter((item) => soalIds.has(item.id));
	const token = rows.token.filter((item) => ujianIds.has(item.ujianId));

	return {
		users: [publicUser(caller)],
		unitAkademik: rows.unitAkademik as any,

		tahunAkademik: [],
		semester: [],
		mataKuliah: [],
		modul: [],
		topik: [],
		soal: soal.map(mapSoal),
		ujian: ujian.map(mapUjian),
		token: token.map(mapToken),
		sesi: sesi.map(mapSesi),
		config: buildConfig(rows.config),
	};
}

export async function buildSnapshotForUser(caller: UserRow): Promise<Snapshot> {
	const rows = await loadSnapshotRows();
	if (caller.role === "super_admin") return adminSnapshot(rows);
	if (caller.role === "admin_prodi" || caller.role === "evaluator") return operatorSnapshot(rows, caller);
	return pesertaSnapshot(rows, caller);
}
