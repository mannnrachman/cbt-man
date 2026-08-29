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
	mapSesi, mapPenawaran,
	buildConfig 
} from "./mappers";

export async function loadSnapshotRows(): Promise<SnapshotRows> {
		const [
			users, unitAkademik, tahunAkademik, semester, mataKuliah,
			modul, topik, penawaran, soal,
			ujian, token, sesi, config
		] = await Promise.all([
			prisma.user.findMany({ include: { createdUjians: false } }),
			prisma.unitAkademik.findMany({ orderBy: { nama: "asc" } }),

			prisma.tahunAkademik.findMany({ orderBy: { nama: "asc" } }),
			prisma.semester.findMany({ orderBy: { nama: "asc" } }),
			prisma.mataKuliah.findMany({ orderBy: { nama: "asc" } }),
			prisma.modul.findMany({ orderBy: { nama: "asc" } }),
			prisma.topik.findMany({ orderBy: { nama: "asc" } }),
			prisma.penawaranMataKuliah.findMany({ orderBy: { createdAt: "asc" } }),
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
		penawaran: penawaran.map(mapPenawaran),

		modul: modul.map(m => ({ ...m, mataKuliahId: m.mataKuliahId ?? undefined })), 
		topik: topik.map((item) => ({ ...item, mataKuliahId: item.mataKuliahId ?? undefined })), soal, ujian, token, sesi, config
	};
}

export function adminSnapshot(rows: SnapshotRows): Snapshot {
	return {
		users: rows.users.map(publicUser),
		unitAkademik: rows.unitAkademik as any,

		tahunAkademik: rows.tahunAkademik,
		semester: rows.semester,
		mataKuliah: rows.mataKuliah,
		penawaran: rows.penawaran,
		modul: rows.modul,
		topik: rows.topik.map((item) => ({ ...item, mataKuliahId: item.mataKuliahId ?? undefined })),
		soal: rows.soal.map(mapSoal),
		ujian: rows.ujian.map(mapUjian),
		token: rows.token.map(mapToken),
		sesi: rows.sesi.map(mapSesi),
		config: buildConfig(rows.config),
	};
}

export function operatorSnapshot(rows: SnapshotRows, caller: UserRow): Snapshot {
	const parseScope = (value: string) => {
		try {
			const parsed = JSON.parse(value || "[]");
			return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : null;
		} catch {
			return null;
		}
	};
	const parsedAllowedTopikIds = parseScope(caller.allowedTopikIds);
	const parsedMataKuliahIds = parseScope(caller.mataKuliahIds);
	const unrestricted =
		parsedAllowedTopikIds !== null &&
		parsedMataKuliahIds !== null &&
		parsedAllowedTopikIds.length === 0 &&
		parsedMataKuliahIds.length === 0;
	const allowedTopikIds = new Set(parsedAllowedTopikIds || []);
	const allowedMataKuliahIds = new Set(parsedMataKuliahIds || []);
	const modulById = new Map(rows.modul.map((item) => [item.id, item]));
	const topik = unrestricted
		? rows.topik
		: rows.topik.filter((item) => {
			const modul = modulById.get(item.modulId);
			const mataKuliahId = item.mataKuliahId ?? modul?.mataKuliahId;
			return allowedTopikIds.has(item.id) || !!mataKuliahId && allowedMataKuliahIds.has(mataKuliahId);
		});
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
		: rows.ujian.filter((item) => {
			const topicMatch = parseJson<{ topikId: string }[]>(item.topicSets, []).some((set) => topikIds.has(set.topikId));
			return topicMatch || (!!item.mataKuliahId && allowedMataKuliahIds.has(item.mataKuliahId));
		});
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
		mataKuliah: unrestricted
			? rows.mataKuliah
			: rows.mataKuliah.filter((item) => allowedMataKuliahIds.has(item.id)),
		penawaran: unrestricted ? rows.penawaran : rows.penawaran.filter((item) => allowedMataKuliahIds.has(item.mataKuliahId)),
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
		const offering = item.penawaranId ? rows.penawaran.find((value) => value.id === item.penawaranId) : undefined;
		return item.status === "published" && (!!offering?.pesertaIds.includes(caller.id) || (!!caller.unitId && groupIds.includes(caller.unitId)));
	});
	const ujianIds = new Set(ujian.map((item) => item.id));
	const sesi = rows.sesi.filter(
		(item) => item.pesertaId === caller.id && ujianIds.has(item.ujianId),
	);
	const soalIds = new Set(
		sesi.flatMap((item) => parseJson<string[]>(item.soalIds, [])),
	);

	// Answer keys (`benar`) and `pembahasan` are only exposed once the sesi is
	// finished AND the exam publishes result detail. During the exam (or when
	// results stay hidden) they are redacted server-side so the snapshot never
	// leaks the key. Redaction wins when a soal is shared with a non-revealed
	// sesi (e.g. the same bank soal reused by an ongoing exam).
	const ujianById = new Map(ujian.map((item) => [item.id, item]));
	const revealed = new Set<string>();
	const withheld = new Set<string>();
	for (const item of sesi) {
		const u = ujianById.get(item.ujianId);
		const canReveal =
			item.status === "selesai" && !!u?.showResult && !!u.showResultDetail;
		for (const id of parseJson<string[]>(item.soalIds, [])) {
			(canReveal ? revealed : withheld).add(id);
		}
	}
	for (const id of withheld) revealed.delete(id);

	const snapshotBySessionAndId = new Map(
		sesi.flatMap((item) =>
			parseJson<ReturnType<typeof mapSoal>[]>(item.soalSnapshot, [])
				.map((soal) => [`${item.id}:${soal.id}`, soal] as const),
		),
	);
	const soal = [...soalIds].flatMap((id) => {
			const session = sesi.find((item) => parseJson<string[]>(item.soalIds, []).includes(id));
			const snapshot = session ? snapshotBySessionAndId.get(`${session.id}:${id}`) : undefined;
			const row = rows.soal.find((item) => item.id === id);
			if (!snapshot && !row) return [];
			const mapped = snapshot ?? mapSoal(row!);
			if (revealed.has(id)) return mapped;
			return {
				...mapped,
				jawaban: mapped.jawaban.map((j) => ({ ...j, benar: false })),
				pembahasan: "",
			};
	});
	const sesiForParticipant = sesi.map((row) => {
		const mapped = mapSesi(row);
		const exam = ujianById.get(row.ujianId);
		const canShowScore = row.status === "selesai" && !!exam?.showResult;
		const canShowDetail = canShowScore && !!exam?.showResultDetail;
		return {
			...mapped,
			soalSnapshot: [],
			jawaban: canShowDetail
				? mapped.jawaban
				: mapped.jawaban.map(({ skor: _skor, catatanGrader: _catatanGrader, ...answer }) => answer),
			skorTotal: canShowScore ? mapped.skorTotal : undefined,
			maxSkor: canShowScore ? mapped.maxSkor : undefined,
			gradedAt: canShowScore ? mapped.gradedAt : undefined,
			gradedBy: undefined,
		};
	});
	return {
		users: [publicUser(caller)],
		unitAkademik: rows.unitAkademik as any,
		tahunAkademik: [],
		semester: [],
		mataKuliah: [],
		penawaran: [],
		modul: [],
		topik: [],
		soal,
		ujian: ujian.map(mapUjian),
		// Token codes are secrets shared out-of-band by the proctor. A participant
		// may claim a code through the narrow claim action, but never receives the
		// exam's token inventory in the general snapshot.
		token: [],
		sesi: sesiForParticipant,
		config: buildConfig(rows.config),
	};
}

export async function buildSnapshotForUser(caller: UserRow): Promise<Snapshot> {
	const rows = await loadSnapshotRows();
	if (caller.role === "super_admin") return adminSnapshot(rows);
	if (caller.role === "admin_prodi" || caller.role === "evaluator") return operatorSnapshot(rows, caller);
	return pesertaSnapshot(rows, caller);
}
