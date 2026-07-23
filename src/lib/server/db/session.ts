// Sesi login server-side. Token opaque 256-bit disimpan di cookie httpOnly +
// row `Session` di DB. Cookie = single source of truth autentikasi; state client
// (zustand) hanya cache render, tak dipercaya untuk keputusan keamanan.
//
// Modul ini bekerja dengan row prisma mentah (tanpa mapping ke tipe `User`);
// pemetaan dilakukan di pemanggil (functions.ts) agar tak ada import melingkar.
import { randomBytes } from "node:crypto";
import {
	getCookie,
	setResponseHeader,
	getRequestHeaders,
} from "@tanstack/react-start/server";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "cbtman_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

function cookieAttributes(maxAgeSeconds: number): string {
	// `Secure` hanya di production — dev (http://localhost) tidak bisa set cookie Secure.
	const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
	return `; HttpOnly; SameSite=Lax; Path=/${secure}; Max-Age=${maxAgeSeconds}`;
}

export function setSessionCookie(token: string): void {
	setResponseHeader(
		"Set-Cookie",
		`${SESSION_COOKIE}=${token}${cookieAttributes(SESSION_TTL_SECONDS)}`,
	);
}

export function clearSessionCookie(): void {
	setResponseHeader("Set-Cookie", `${SESSION_COOKIE}=${cookieAttributes(0)}`);
}

export function readSessionToken(): string | null {
	return getCookie(SESSION_COOKIE) ?? null;
}

export function generateSessionToken(): string {
	return randomBytes(32).toString("hex"); // 256-bit, unguessable
}

/** Buat row Session baru, kembalikan token yang akan disimpan di cookie. */
export async function createSession(
	userId: string,
	userAgent?: string,
	deviceFingerprint?: string,
): Promise<string> {
	const config = await prisma.appConfig.findUnique({ where: { id: "app" } });
	if (config && !config.multiDevice) {
		await prisma.session.deleteMany({ where: { userId } });
	}

	const token = generateSessionToken();
	await prisma.session.create({
		data: {
			id: token,
			userId,
			expiresAt: new Date(Date.now() + SESSION_TTL_MS),
			userAgent,
			deviceFingerprint,
		},
	});
	return token;
}

/**
 * Validasi token: lookup row, cek expiry + `aktif`. Sliding refresh `expiresAt`
 * bila valid. Lazy-delete row expired/nonaktif agar tabel tetap bersih.
 * Enforce mobileLock & multiDevice from AppConfig.
 * Kembalikan row User prisma mentah bila valid, null bila tidak.
 */
export async function validateSession(
	token: string | null,
): Promise<NonNullable<
	Awaited<ReturnType<typeof prisma.user.findUnique>>
> | null> {
	if (!token) return null;
	const row = await prisma.session.findUnique({
		where: { id: token },
		include: { user: true },
	});
	if (!row) return null;
	const now = Date.now();
	if (row.expiresAt.getTime() < now || !row.user.aktif) {
		await prisma.session
			.delete({ where: { id: token } })
			.catch(() => undefined);
		return null;
	}

	// Enforce mobileLock and multiDevice from AppConfig
	const config = await prisma.appConfig.findUnique({ where: { id: "app" } });
	if (config) {
		// mobileLock: block mobile devices
		if (config.mobileLock && row.userAgent) {
			const ua = row.userAgent.toLowerCase();
			const isMobile = /mobile|android|iphone|ipad|ipod/.test(ua);
			if (isMobile) {
				await prisma.session
					.delete({ where: { id: token } })
					.catch(() => undefined);
				return null;
			}
		}
		// multiDevice: if false, only allow one active session per user
		if (!config.multiDevice && row.deviceFingerprint) {
			const otherSessions = await prisma.session.findMany({
				where: {
					userId: row.userId,
					NOT: { id: token },
					expiresAt: { gt: new Date(now) },
				},
			});
			if (otherSessions.length > 0) {
				// ponytail: Race condition between concurrent logins is acceptable because this lazy cleanup always deletes older sessions eventually. True atomicity requires DB locking which is overkill.
				for (const s of otherSessions) {
					await prisma.session
						.delete({ where: { id: s.id } })
						.catch(() => undefined);
				}
			}
		}
	}

	// Sliding refresh — perpanjang TTL tiap akses valid.
	await prisma.session
		.update({
			where: { id: token },
			data: { expiresAt: new Date(now + SESSION_TTL_MS) },
		})
		.catch(() => undefined);
	return row.user;
}

export async function deleteSession(token: string | null): Promise<void> {
	if (!token) return;
	await prisma.session.delete({ where: { id: token } }).catch(() => undefined);
}

/** Hapus semua sesi milik seorang user (admin revoke / force-logout instan). */
export async function deleteSessionsForUser(userId: string): Promise<number> {
	const result = await prisma.session.deleteMany({ where: { userId } });
	return result.count;
}

/** Get device fingerprint from request headers (simple hash of UA + IP) */
export async function getDeviceFingerprint(): Promise<string> {
	// ponytail: UA and IP checks are just deterrents against casual sharing. Upgrade path: Safe Exam Browser integration + trusted proxy validation for X-Forwarded-For.
	const headers = getRequestHeaders();
	const ua = headers.get("user-agent") ?? "";
	const ip =
		headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		headers.get("x-real-ip") ??
		"unknown";
	// Simple hash
	let hash = 0;
	for (let i = 0; i < ua.length; i++)
		hash = ((hash << 5) - hash + ua.charCodeAt(i)) | 0;
	for (let i = 0; i < ip.length; i++)
		hash = ((hash << 5) - hash + ip.charCodeAt(i)) | 0;
	return Math.abs(hash).toString(36);
}
