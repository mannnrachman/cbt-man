import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAdminResult } from "../db/auth";
import type { User, UnitAkademik, MataKuliah, PenawaranMataKuliah, Modul, Topik, Soal, Ujian, TokenUjian, TokenClaim, SesiUjian, AppConfig } from "@/lib/cbt/types";

import { stringifyJson, toBigInt } from "../db/json";

export const importBackupServer = createServerFn({ method: "POST" })
	.validator(
		z.object({
			users: z.array(z.any()),
			unitAkademik: z.array(z.any()),
			mataKuliah: z.array(z.any()),
			modul: z.array(z.any()),
			topik: z.array(z.any()),
			soal: z.array(z.any()),
			ujian: z.array(z.any()),
			penawaran: z.array(z.any()).default([]),
			token: z.array(z.any()),
			tokenClaims: z.array(z.any()).default([]),
			sesi: z.array(z.any()),
			config: z.any(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await requireAdminResult();
		if (!auth.ok) return { ok: false as const, error: auth.error };
		await prisma.$transaction(async (tx) => {
			await tx.jawaban.deleteMany();
			await tx.sesiUjian.deleteMany();
			await tx.tokenUjian.deleteMany();
			await tx.soal.deleteMany();
			await tx.ujian.deleteMany();
			await tx.topik.deleteMany();
			await tx.modul.deleteMany();
			await tx.penawaranMataKuliah.deleteMany();
			await tx.mataKuliah.deleteMany();
			await tx.user.deleteMany();
			await tx.unitAkademik.deleteMany();
			await tx.appConfig.deleteMany();

			if (data.unitAkademik.length)
				await tx.unitAkademik.createMany({ data: data.unitAkademik as UnitAkademik[] });
			if (data.mataKuliah.length)
				await tx.mataKuliah.createMany({ data: data.mataKuliah as MataKuliah[] });
			if (data.modul.length)
				await tx.modul.createMany({ data: data.modul as Modul[] });
			if (data.topik.length)
				await tx.topik.createMany({ data: data.topik as Topik[] });
			if (data.penawaran.length)
				await tx.penawaranMataKuliah.createMany({
					data: (data.penawaran as PenawaranMataKuliah[]).map((item) => ({
						id: item.id,
						mataKuliahId: item.mataKuliahId,
						semesterId: item.semesterId ?? null,
						kodeKelas: item.kodeKelas,
						pengampuIds: stringifyJson(item.pengampuIds),
						pesertaIds: stringifyJson(item.pesertaIds),
						createdAt: BigInt(item.createdAt),
					})),
				});
			for (const item of data.users as User[]) {
				await tx.user.create({
					data: {
						...item,
						allowedTopikIds: stringifyJson(item.allowedTopikIds),
						unitId: item.unitId ?? null,

						mataKuliahIds: stringifyJson(item.mataKuliahIds),
						detail: item.detail ?? null,
						createdAt: BigInt(item.createdAt),
					},
				});
			}
			for (const item of data.soal as Soal[]) {
				await tx.soal.create({
					data: {
						id: item.id,
						topikId: item.topikId,
						detail: item.detail,
						tipe: item.tipe,
						kesulitan: item.kesulitan,
						audioFileId: item.audioFileId ?? null,
						audioPlayOnce: item.audioPlayOnce,
						pembahasan: item.pembahasan,
						createdAt: BigInt(item.createdAt),
						jawaban: { create: item.jawaban },
					},
				});
			}
			for (const item of data.ujian as Ujian[]) {
				await tx.ujian.create({
					data: {
						...item,
						status: item.status ?? "published",
						beginAt: toBigInt(item.beginAt),
						endAt: toBigInt(item.endAt),
						groupIds: stringifyJson(item.groupIds),
						topicSets: stringifyJson(item.topicSets),
						createdAt: BigInt(item.createdAt),
					},
				});
			}
			if (data.token.length) {
				const seen = new Map<string, TokenUjian>();
				for (const t of data.token as TokenUjian[]) {
					seen.set(`${t.ujianId}::${t.kode}`, t);
				}
				const incoming = [...seen.values()];
				const existingKeys = new Set(
					(
						await tx.tokenUjian.findMany({
							where: {
								OR: incoming.map((t) => ({ ujianId: t.ujianId, kode: t.kode })),
							},
							select: { ujianId: true, kode: true },
						})
					).map((row) => `${row.ujianId}::${row.kode}`),
				);
				const toInsert = incoming.filter(
					(t) => !existingKeys.has(`${t.ujianId}::${t.kode}`),
				);
				if (toInsert.length) {
					await tx.tokenUjian.createMany({
						data: toInsert.map((item) => ({
							...item,
							dipakaiOleh: item.dipakaiOleh ?? null,
							dipakaiAt: toBigInt(item.dipakaiAt),
						})),
					});
				}
				const claims = data.tokenClaims.length ? [] : [...new Map(incoming
					.filter((item) => item.dipakaiOleh)
					.map((item) => ({
						id: `tc_legacy_${item.id}`,
						ujianId: item.ujianId,
						pesertaId: item.dipakaiOleh!,
						kode: item.kode,
						claimedAt: toBigInt(item.dipakaiAt) ?? BigInt(Date.now()),
					}))
					.map((claim) => [`${claim.ujianId}::${claim.pesertaId}`, claim] as const)).values()];
				if (claims.length) await tx.tokenClaim.createMany({ data: claims });
			}
			if (data.sesi.length) {
				await tx.sesiUjian.createMany({
					data: (data.sesi as SesiUjian[]).map((item) => ({
						...item,
						mulaiAt: toBigInt(item.mulaiAt),
						selesaiAt: toBigInt(item.selesaiAt),
						endsAt: toBigInt(item.endsAt),
						soalIds: stringifyJson(item.soalIds),
						soalSnapshot: stringifyJson(item.soalSnapshot),
						jawabanOrder: stringifyJson(item.jawabanOrder),
						jawaban: stringifyJson(item.jawaban),
						gradedAt: toBigInt(item.gradedAt),
						gradedBy: item.gradedBy ?? null,
						createdAt: BigInt(item.createdAt),
					})),
				});
			}
			if (data.tokenClaims.length) {
				await tx.tokenClaim.createMany({
					data: (data.tokenClaims as TokenClaim[]).map((item) => ({
						id: item.id,
						ujianId: item.ujianId,
						pesertaId: item.pesertaId,
						kode: item.kode,
						claimedAt: BigInt(item.claimedAt),
					})),
				});
			}
			await tx.appConfig.create({
				data: {
					id: "app",
					...data.config,
					roleAccess: stringifyJson((data.config as AppConfig).roleAccess),
				},
			});
		});

		return { ok: true as const };
	});

export const exportTokenClaimsServer = createServerFn({ method: "GET" }).handler(async () => {
	const auth = await requireAdminResult();
	if (!auth.ok) throw new Error(auth.error);
	return prisma.tokenClaim.findMany({
		select: { id: true, ujianId: true, pesertaId: true, kode: true, claimedAt: true },
	});
});

export const resetAllDataServer = createServerFn({ method: "POST" }).handler(
	async () => {
		const auth = await requireAdminResult();
		if (!auth.ok) return { ok: false as const, error: auth.error };
		await prisma.$transaction(async (tx) => {
			await tx.jawaban.deleteMany();
			await tx.sesiUjian.deleteMany();
			await tx.tokenUjian.deleteMany();
			await tx.soal.deleteMany();
			await tx.ujian.deleteMany();
			await tx.topik.deleteMany();
			await tx.modul.deleteMany();
			await tx.penawaranMataKuliah.deleteMany();
			await tx.mataKuliah.deleteMany();
			await tx.user.deleteMany();
			await tx.unitAkademik.deleteMany();

			await tx.appConfig.deleteMany();
		});

		return { ok: true as const };
	},
);
