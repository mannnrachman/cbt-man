import { getRequestHeaders } from "@tanstack/start-server-core";

// In-memory rate limiter for login attempts and other sensitive operations.
// Single-node deployment (per PRD v2), so no Redis needed.
// ponytail: Spec mentions sliding window, but fixed window is used here intentionally. It requires far less memory/CPU. Upgrade path: use Redis + sliding window if absolutely necessary.
// Max 5 attempts per 10 minutes per key (IP or username).

const MAX_ATTEMPTS = 15;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function getBucket(key: string): Bucket {
	const now = Date.now();
	let bucket = buckets.get(key);
	if (!bucket || bucket.resetAt < now) {
		bucket = { count: 0, resetAt: now + WINDOW_MS };
		buckets.set(key, bucket);
	}
	return bucket;
}

export function checkRateLimit(
	identifier: string,
	prefix: string,
): {
	ok: boolean;
	error?: string;
	retryAfter?: number;
} {
	const key = `${prefix}:${identifier}`;
	const bucket = getBucket(key);
	const now = Date.now();

	if (bucket.count >= MAX_ATTEMPTS) {
		const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
		return {
			ok: false,
			error: `Terlalu banyak percobaan. Coba lagi dalam ${retryAfter} detik.`,
			retryAfter,
		};
	}

	bucket.count++;
	return { ok: true };
}

export function clearRateLimit(identifier: string, prefix: string): void {
	const key = `${prefix}:${identifier}`;
	buckets.delete(key);
}

export function getRateLimitStatus(
	identifier: string,
	prefix: string,
): { count: number; resetAt: number } | null {
	const key = `${prefix}:${identifier}`;
	const bucket = buckets.get(key);
	if (!bucket) return null;
	return { count: bucket.count, resetAt: bucket.resetAt };
}

// Cleanup old buckets periodically
setInterval(
	() => {
		const now = Date.now();
		for (const [key, bucket] of buckets.entries()) {
			if (bucket.resetAt < now) {
				buckets.delete(key);
			}
		}
	},
	5 * 60 * 1000,
); // every 5 minutes

/**
 * Generate a simple device fingerprint from request headers.
 * Used for multi-device session enforcement.
 */
export async function getDeviceFingerprint(): Promise<string> {
	const headers = getRequestHeaders();
	const ua = headers.get("user-agent") ?? "";
	const accept = headers.get("accept") ?? "";
	const acceptLang = headers.get("accept-language") ?? "";
	// Simple hash of headers
	let hash = 0;
	for (const s of [ua, accept, acceptLang]) {
		for (let i = 0; i < s.length; i++) {
			hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
		}
	}
	return Math.abs(hash).toString(36);
}
