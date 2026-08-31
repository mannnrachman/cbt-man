export async function compareAndSetMembership<T>(
  update: () => Promise<number>,
  readAcceptedState: () => Promise<T | null>,
): Promise<T | null> {
  return (await update()) === 1 ? readAcceptedState() : null;
}
