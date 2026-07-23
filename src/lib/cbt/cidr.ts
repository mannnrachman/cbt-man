// CIDR utilities for IP range enforcement.
// Supports CIDR notation (e.g., "192.168.1.0/24") and comma-separated lists.

export function ipToNumber(ip: string): number {
	const parts = ip.split(".");
	if (parts.length !== 4) return NaN;
	let num = 0;
	for (let i = 0; i < 4; i++) {
		const octet = parseInt(parts[i], 10);
		if (isNaN(octet) || octet < 0 || octet > 255) return NaN;
		num = (num << 8) + octet;
	}
	return num >>> 0;
}

export function cidrToRange(
	cidr: string,
): { start: number; end: number } | null {
	const [ip, prefixStr] = cidr.split("/");
	if (!ip) return null;
	const prefix = prefixStr ? parseInt(prefixStr, 10) : 32;
	if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;
	const base = ipToNumber(ip);
	if (isNaN(base)) return null;
	const mask = prefix === 0 ? 0 : 0xffffffff << (32 - prefix);
	const start = (base & mask) >>> 0;
	const end = (start | ~mask) >>> 0;
	return { start, end };
}

export function ipInRanges(ip: string, ranges: string): boolean {
	if (!ranges || !ranges.trim()) return true; // no restriction = allow all
	const clientNum = ipToNumber(ip);
	if (isNaN(clientNum)) return false;

	for (const range of ranges.split(",")) {
		const trimmed = range.trim();
		if (!trimmed) continue;
		const parsed = cidrToRange(trimmed);
		if (parsed && clientNum >= parsed.start && clientNum <= parsed.end) {
			return true;
		}
	}
	return false;
}

export function extractClientIP(headers: Headers): string {
	// Check common proxy headers in order of preference
	const forwarded = headers.get("x-forwarded-for");
	if (forwarded) {
		return forwarded.split(",")[0].trim();
	}
	const realIP = headers.get("x-real-ip");
	if (realIP) return realIP;
	return "unknown";
}
