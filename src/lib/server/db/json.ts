export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}

export function toNumber(value: bigint | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

export function toBigInt(value: number | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  return BigInt(Math.trunc(value));
}
