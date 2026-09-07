/** Stable variation from every module of the QR matrix. */
export function contentVariation(modules: readonly (readonly boolean[])[]): number {
  let hash = Math.imul(2166136261 ^ modules.length, 16777619);
  for (const row of modules) {
    for (const dark of row) hash = Math.imul(hash ^ Number(dark), 16777619);
  }
  return (hash >>> 0) / 0x100000000;
}
