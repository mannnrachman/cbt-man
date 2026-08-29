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
