/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "@/lib/server/db/prisma";

import { seedIfNeeded } from "@/lib/server/db/auth";
import type { PublicExamSchedule } from "@/lib/cbt/types";

export const getTodaysExamsServer = createServerFn({ method: "GET" }).handler(
	async () => {
		await seedIfNeeded();
		const startOfDay = new Date();
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date();
		endOfDay.setHours(23, 59, 59, 999);

		const ujianList = await prisma.ujian.findMany({
					where: {
						status: "published",
				OR: [
					{
						beginAt: {
							gte: BigInt(startOfDay.getTime()),
							lte: BigInt(endOfDay.getTime()),
						},
					},
					{
						endAt: {
							gte: BigInt(startOfDay.getTime()),
							lte: BigInt(endOfDay.getTime()),
						},
					},
					{
						beginAt: { lte: BigInt(startOfDay.getTime()) },
						endAt: { gte: BigInt(endOfDay.getTime()) },
					},
				],
			},
			orderBy: { beginAt: "asc" },
		});

		const schedule = (row: (typeof ujianList)[number]): PublicExamSchedule => ({
			id: row.id,
			nama: row.nama,
			beginAt: row.beginAt ? Number(row.beginAt) : undefined,
			endAt: row.endAt ? Number(row.endAt) : undefined,
			durasiMenit: row.durasiMenit,
			groupIds: JSON.parse(row.groupIds) as string[],
		});
		const online = ujianList.filter((u) => u.mode === "online").map(schedule);
		const offline = ujianList.filter((u) => u.mode === "offline").map(schedule);

		const groupNames = await prisma.unitAkademik.findMany({ select: { id: true, nama: true } });
		const groupsMap = Object.fromEntries(groupNames.map((g: any) => [g.id, g.nama]));

		
		const serverTime = Date.now();

		return { ok: true as const, online, offline, groupsMap, serverTime };
	},
);
