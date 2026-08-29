export function snapFormControlAlignment(layout, peers = [], options = {}) {
  const tolerance = Math.max(0, Number(options.tolerance ?? 5));
  const current = normalizeLayout(layout);
  const candidates = peers.map(normalizeLayout).filter(Boolean);
  if (!current || !candidates.length) return { ...layout, guideX: null, guideY: null };

  const xMatch = nearestAlignment(
    [current.x, current.x + current.width / 2, current.x + current.width],
    candidates.flatMap(peer => [peer.x, peer.x + peer.width / 2, peer.x + peer.width]),
    tolerance
  );
  const yMatch = nearestAlignment(
    [current.y, current.y + current.height / 2, current.y + current.height],
    candidates.flatMap(peer => [peer.y, peer.y + peer.height / 2, peer.y + peer.height]),
    tolerance
  );

  return {
    ...layout,
    x: Math.max(0, Math.round(current.x + (xMatch?.delta ?? 0))),
    y: Math.max(0, Math.round(current.y + (yMatch?.delta ?? 0))),
    guideX: xMatch?.guide ?? null,
    guideY: yMatch?.guide ?? null
  };
}

function normalizeLayout(layout) {
  if (!layout) return null;
  const x = Number(layout.x);
  const y = Number(layout.y);
  const width = Number(layout.width);
  const height = Number(layout.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x, y, width, height };
}

function nearestAlignment(movingMarks, peerMarks, tolerance) {
  let best = null;
  for (const moving of movingMarks) {
    for (const peer of peerMarks) {
      const rawDelta = peer - moving;
      if (Math.abs(rawDelta) > tolerance) continue;
      const delta = Math.round(rawDelta);
      const residual = Math.abs((moving + delta) - peer);
      if (residual > 0.51) continue;
      const distance = Math.abs(rawDelta);
      if (!best || distance < best.distance) best = { delta, guide: peer, distance };
    }
  }
  return best;
}
