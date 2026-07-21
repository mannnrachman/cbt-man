import { createServerFn } from "@tanstack/react-start";
import { prisma } from "../db/prisma";
import { requireCaller, seedIfNeeded } from "../db/auth";
import { buildSnapshotForUser } from "../repos/snapshot";
import { buildPublicBootConfig } from "../repos/mappers";

export const getCbtSnapshot = createServerFn({ method: "GET" }).handler(
	async () => {
		await seedIfNeeded();
		const caller = await requireCaller();
		if (!caller) throw new Error("Unauthorized");
		return buildSnapshotForUser(caller);
	},
);

export const getPublicBootConfigServer = createServerFn({
	method: "GET",
}).handler(async () => {
	await seedIfNeeded();
	const config = await prisma.appConfig.findUnique({ where: { id: "app" } });
	return buildPublicBootConfig(config);
});
