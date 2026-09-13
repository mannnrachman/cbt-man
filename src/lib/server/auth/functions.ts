import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestIP, getRequestHeaders } from "@tanstack/start-server-core";
import { checkRateLimit, clearRateLimit, recordRateLimit } from "@/lib/cbt/rate-limit";
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
import { writeAuditLog } from "../db/audit";

export const loginServer = createServerFn({ method: "POST" })
	.validator(
		z.object({ username: z.string().min(1), password: z.string().min(1) }),
	)
	.handler(async ({ data }) => {
		await seedIfNeeded();
		const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
		const username = data.username.toLowerCase();
		const ipCheck = checkRateLimit(ip, "login:ip", { record: false });
		if (!ipCheck.ok) {
			return { ok: false as const, error: ipCheck.error };
		}
		const userCheck = checkRateLimit(username, "login:user", { record: false });
		if (!userCheck.ok) {
			return { ok: false as const, error: userCheck.error };
		}

		const user = await prisma.user.findUnique({
			where: { username: data.username },
		});
		const invalidCreds = { ok: false as const, error: "Username atau password salah" };
		if (!user || !user.aktif || !(await verifyPassword(data.password, user.passwordHash))) {
			recordRateLimit(ip, "login:ip");
			recordRateLimit(username, "login:user");
			if (user && !user.aktif) return { ok: false as const, error: "Akun dinonaktifkan" };
			return invalidCreds;
		}

		clearRateLimit(ip, "login:ip");
		clearRateLimit(username, "login:user");
		const fp = await getDeviceFingerprint();
		const ua = getRequestHeaders().get("user-agent") ?? "";
		const audit = await writeAuditLog({
			userId: user.id,
			userRole: user.role,
			action: "auth.login",
			entity: "session",
			details: JSON.stringify({ ip }),
		});
		if (!audit.ok) return { ok: false as const, error: audit.error };
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
		const caller = await validateSession(readSessionToken());
		if (caller) {
			const audit = await writeAuditLog({
				userId: caller.id,
				userRole: caller.role,
				action: "auth.logout",
				entity: "session",
			});
			if (!audit.ok) return { ok: false as const, error: audit.error };
		}
		const removed = await deleteSession(readSessionToken());
		if (!removed.ok) return { ok: false as const, error: removed.error };
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
