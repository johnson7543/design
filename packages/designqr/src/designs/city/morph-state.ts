export function cityEase(progress: number, start = 0, end = 1) {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function cityMorphState(progress: number) {
  // Building blocks reveal gradually in roof-to-base sections beforehand;
  // streets/details keep this coverage-first handoff. Never fade the original
  // city throughout the reveal: that exposes back faces and looks glassy.
  const handoff = cityEase(progress, .40, .46);
  return {
    cityOpacity: 1 - handoff,
    voxelOpacity: handoff,
    vertical: cityEase(progress, .02, .92),
    // Full-color city tiles supply BOTH light and dark cells. The canonical
    // paper/ink layer is only a final, pixel-identical endpoint handoff.
    // Keep coverage beneath the final QR until it is fully opaque, too.
    tileOpacity: progress < 1 ? cityEase(progress, .30, .42) : 0,
    qrOpacity: cityEase(progress, .94, 1),
    plateOpacity: cityEase(progress, .94, 1),
  };
}
