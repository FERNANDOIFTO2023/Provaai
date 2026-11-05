/** SVG-space offsets keep the eyes inside Bloub, regardless of viewport size. */
export function gazeOffset(
  clientX: number,
  clientY: number,
  bounds: { left: number; top: number; width: number; height: number },
) {
  if (
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY)
  )
    return { x: 0, y: 0, tilt: 0 };
  const dx =
    (clientX - bounds.left - bounds.width / 2) / Math.max(bounds.width, 240);
  const dy =
    (clientY - bounds.top - bounds.height / 2) / Math.max(bounds.height, 240);
  const distance = Math.max(1, Math.hypot(dx, dy));
  return {
    x: (dx / distance) * 11,
    y: (dy / distance) * 7,
    tilt: (dx / distance) * 5,
  };
}
