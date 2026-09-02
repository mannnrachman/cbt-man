/**
 * @param {{ nama: string }[]} moduls
 * @param {string} query
 */
export function filterModuls(moduls, query) {
  const normalizedQuery = query.toLowerCase();
  return moduls.filter(
    ({ nama }) => !normalizedQuery || nama.toLowerCase().includes(normalizedQuery),
  );
}
