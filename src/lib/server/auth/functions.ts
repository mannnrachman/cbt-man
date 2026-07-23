import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestIP, getRequestHeaders } from "@tanstack/start-server-core";
import { checkRateLimit, clearRateLimit } from "@/lib/cbt/rate-limit";
import { verifyPassword } from "@/lib/cbt/hash";
import { publicUser } from "../repos/mappers";
import { prisma } from "../db/prisma";
import {
	createSession,
	deleteSession,
	readSessionToken,
	setSessionCookie,
	clearSessionCookie,
	validateSession,
	getDeviceFingerprint,
} from "../db/session";
import { seedIfNeeded } from "../db/auth";

export const loginServer = createServerFn({ method: "POST" })
	.validator(
		z.object({ username: z.string().min(1), password: z.string().min(1) }),
	)
	.handler(async ({ data }) => {
		await seedIfNeeded();
		const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
		const ipCheck = checkRateLimit(ip, "login:ip");
		if (!ipCheck.ok) {
			return { ok: false as const, error: ipCheck.error };
		}
		const userCheck = checkRateLimit(data.username.toLowerCase(), "login:user");
		if (!userCheck.ok) {
			return { ok: false as const, error: userCheck.error };
		}

		const user = await prisma.user.findUnique({
			where: { username: data.username },
		});
		const invalidCreds = { ok: false as const, error: "Username atau password salah" };
		if (!user) return invalidCreds;
		if (!user.aktif) return { ok: false as const, error: "Akun dinonaktifkan" };
		const ok = await verifyPassword(data.password, user.passwordHash);
		if (!ok) return invalidCreds;
		
		clearRateLimit(ip, "login:ip");
		clearRateLimit(data.username.toLowerCase(), "login:user");
		const fp = await getDeviceFingerprint();
		const ua = getRequestHeaders().get("user-agent") ?? "";
		const token = await createSession(user.id, ua, fp);
		setSessionCookie(token);
		return { ok: true as const, user: publicUser(user) };
	});

export const validateSessionServer = createServerFn({ method: "POST" }).handler(
	async () => {
		try {
			await seedIfNeeded();
			const userRow = await validateSession(readSessionToken());
			return { user: userRow ? publicUser(userRow) : null };
		} catch {
			return { user: null };
		}
	},
);

export const logoutServer = createServerFn({ method: "POST" }).handler(
	async () => {
		await seedIfNeeded();
		await deleteSession(readSessionToken());
		clearSessionCookie();
		return { ok: true as const };
	},
);

export const ensureSeedServer = createServerFn({ method: "POST" }).handler(
	async () => {
		await seedIfNeeded();
		return { ok: true as const };
	},
);
