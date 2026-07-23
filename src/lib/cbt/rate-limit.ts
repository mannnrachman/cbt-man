import { getRequestHeaders } from "@tanstack/start-server-core";

// In-memory rate limiter for login attempts and other sensitive operations.
// Single-node deployment (per PRD v2), so no Redis needed.
// ponytail: Spec mentions sliding window, but fixed window is used here intentionally. It requires far less memory/CPU. Upgrade path: use Redis + sliding window if absolutely necessary.
// Max 5 attempts per 10 minutes per key (IP or username).

const MAX_ATTEMPTS = 15;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_KEYS = 5000; // Cap map size to prevent memory leaks

type Bucket = number[]; // Array of timestamps

const buckets = new Map<string, Bucket>();

function getWindow(key: string, now: number): Bucket {
	let bucket = buckets.get(key);
	if (bucket) {
		// LRU behavior: remove and re-add to push to end of map iteration order
		buckets.delete(key);
	} else {
		bucket = [];
	}
	
	// Remove old timestamps outside the sliding window
	const cutoff = now - WINDOW_MS;
	bucket = bucket.filter((t) => t > cutoff);
	
	buckets.set(key, bucket);
	
	// Enforce max size (remove oldest / least recently used)
	if (buckets.size > MAX_KEYS) {
		const firstKey = buckets.keys().next().value;
		if (firstKey !== undefined) {
			buckets.delete(firstKey);
		}
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
	const now = Date.now();
	const bucket = getWindow(key, now);

	if (bucket.length >= MAX_ATTEMPTS) {
		const oldest = bucket[0];
		const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
		return {
			ok: false,
			error: `Terlalu banyak percobaan. Coba lagi dalam ${retryAfter} detik.`,
			retryAfter,
		};
	}

	bucket.push(now);
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
	if (!bucket || bucket.length === 0) return null;
	const oldest = bucket[0];
	return { count: bucket.length, resetAt: oldest + WINDOW_MS };
}

// Cleanup old buckets periodically
setInterval(
	() => {
		const now = Date.now();
		const cutoff = now - WINDOW_MS;
		for (const [key, bucket] of buckets.entries()) {
			const valid = bucket.filter((t) => t > cutoff);
			if (valid.length === 0) {
				buckets.delete(key);
			} else {
				buckets.set(key, valid);
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
