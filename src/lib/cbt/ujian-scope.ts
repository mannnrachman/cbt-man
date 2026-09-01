export function parseOperatorScope(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/** Both scope fields must be valid together; one bad field denies everything. */
export type OperatorScopeResolution =
  | { status: "unrestricted" }
  | { status: "denied" }
  | { status: "scoped"; topikIds: string[]; mataKuliahIds: string[] };

export function resolveOperatorScopes(
  allowedTopikIdsRaw: string,
  mataKuliahIdsRaw: string,
): OperatorScopeResolution {
  const topikIds = parseOperatorScope(allowedTopikIdsRaw);
  const mataKuliahIds = parseOperatorScope(mataKuliahIdsRaw);
  if (!topikIds || !mataKuliahIds) return { status: "denied" };
  if (topikIds.length === 0 && mataKuliahIds.length === 0) return { status: "unrestricted" };
  return { status: "scoped", topikIds, mataKuliahIds };
}

export function requestedUjianScopeAllowed(input: {
  unrestricted: boolean;
  topicsPresent: boolean;
  topicsAllowed: boolean;
  allowedMataKuliahIds: ReadonlySet<string>;
  mataKuliahId?: string;
  penawaranRequested: boolean;
  penawaranMataKuliahId?: string;
}): boolean {
  if (input.unrestricted) return true;
  if (!input.topicsAllowed) return false;
  if (input.mataKuliahId && !input.allowedMataKuliahIds.has(input.mataKuliahId)) return false;
  if (
    input.penawaranRequested &&
    (!input.penawaranMataKuliahId || !input.allowedMataKuliahIds.has(input.penawaranMataKuliahId))
  ) {
    return false;
  }
  return input.topicsPresent || !!input.mataKuliahId || input.penawaranRequested;
}
