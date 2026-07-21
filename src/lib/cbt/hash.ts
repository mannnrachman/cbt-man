// Password hashing via Web Crypto PBKDF2-SHA256 (no extra deps).
// Format: pbkdf2$<iterations>$<saltB64>$<hashB64>

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a[i] ^ b[i];
	}
	return result === 0;
}

const ITER = 100_000;
const KEYLEN = 32;

function b64(buf: ArrayBuffer | Uint8Array): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
}
function unb64(str: string): Uint8Array {
	const bin = atob(str);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function derive(
	password: string,
	salt: Uint8Array,
	iter: number,
): Promise<ArrayBuffer> {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(password) as BufferSource,
		"PBKDF2",
		false,
		["deriveBits"],
	);
	return crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: salt as BufferSource,
			iterations: iter,
			hash: "SHA-256",
		},
		key,
		KEYLEN * 8,
	);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await derive(password, salt, ITER);
	return `pbkdf2$${ITER}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	try {
		const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
		if (scheme !== "pbkdf2") return false;
		const iter = parseInt(iterStr, 10);
		const salt = unb64(saltB64);
		const hash = await derive(password, salt, iter);
		const computed = b64(hash);
		// Constant-time comparison to prevent timing attacks
		const a = new TextEncoder().encode(computed);
		const b = new TextEncoder().encode(hashB64);
		if (a.length !== b.length) return false;
		return timingSafeEqual(a, b);
	} catch {
		return false;
	}
}
