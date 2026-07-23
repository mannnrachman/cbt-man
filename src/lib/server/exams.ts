/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "@/lib/server/db/prisma";

import { mapUjian } from "@/lib/server/repos/mappers";
import { seedIfNeeded } from "@/lib/server/db/auth";

export const getTodaysExamsServer = createServerFn({ method: "GET" }).handler(
	async () => {
		await seedIfNeeded();
		const startOfDay = new Date();
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date();
		endOfDay.setHours(23, 59, 59, 999);

		const ujianList = await prisma.ujian.findMany({
			where: {
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

		const online = ujianList.filter((u) => u.mode === "online").map(mapUjian);
		const offline = ujianList.filter((u) => u.mode === "offline").map(mapUjian);
		
		const groupNames = await prisma.unitAkademik.findMany({ select: { id: true, nama: true } });
		const groupsMap = Object.fromEntries(groupNames.map((g: any) => [g.id, g.nama]));

		
		const serverTime = Date.now();

		return { ok: true as const, online, offline, groupsMap, serverTime };
	},
);
