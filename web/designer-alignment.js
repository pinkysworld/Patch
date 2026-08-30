export function snapFormControlAlignment(layout, peers = [], options = {}) {
  const tolerance = Math.max(0, Number(options.tolerance ?? 5));
  const current = normalizeLayout(layout);
  const candidates = peers.map(normalizeLayout).filter(Boolean);
  if (!current || !candidates.length) return emptyAlignment(layout);

  const xMatch = nearestAlignment(
    axisMarks(current, 'x'),
    candidates.flatMap(peer => axisMarks(peer, 'x')),
    tolerance
  );
  const yMatch = nearestAlignment(
    axisMarks(current, 'y'),
    candidates.flatMap(peer => axisMarks(peer, 'y')),
    tolerance
  );

  const spacingX = xMatch ? null : nearestEqualSpacing(current, candidates, 'x', tolerance);
  const spacingY = yMatch ? null : nearestEqualSpacing(current, candidates, 'y', tolerance);
  const deltaX = xMatch?.delta ?? spacingX?.delta ?? 0;
  const deltaY = yMatch?.delta ?? spacingY?.delta ?? 0;
  const x = Math.max(0, Math.round(current.x + deltaX));
  const y = Math.max(0, Math.round(current.y + deltaY));

  return {
    ...layout,
    x,
    y,
    guideX: xMatch?.guide ?? null,
    guideY: yMatch?.guide ?? null,
    guideXKind: xMatch?.kind ?? null,
    guideYKind: yMatch?.kind ?? null,
    spacingX: spacingX ? materializeSpacing(spacingX, x, current.width) : null,
    spacingY: spacingY ? materializeSpacing(spacingY, y, current.height) : null
  };
}

function emptyAlignment(layout) {
  return {
    ...layout,
    guideX: null,
    guideY: null,
    guideXKind: null,
    guideYKind: null,
    spacingX: null,
    spacingY: null
  };
}

function normalizeLayout(layout) {
  if (!layout) return null;
  const x = Number(layout.x);
  const y = Number(layout.y);
  const width = Number(layout.width);
  const height = Number(layout.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width < 0 || height < 0) return null;
  return { x, y, width, height };
}

function axisMarks(layout, axis) {
  if (axis === 'x') {
    return [
      { value: layout.x, role: 'start' },
      { value: layout.x + layout.width / 2, role: 'center' },
      { value: layout.x + layout.width, role: 'end' }
    ];
  }
  return [
    { value: layout.y, role: 'start' },
    { value: layout.y + layout.height / 2, role: 'center' },
    { value: layout.y + layout.height, role: 'end' }
  ];
}

function nearestAlignment(movingMarks, peerMarks, tolerance) {
  let best = null;
  for (const moving of movingMarks) {
    for (const peer of peerMarks) {
      const rawDelta = peer.value - moving.value;
      if (Math.abs(rawDelta) > tolerance) continue;
      const delta = Math.round(rawDelta);
      const residual = Math.abs((moving.value + delta) - peer.value);
      if (residual > 0.51) continue;
      const distance = Math.abs(rawDelta);
      const kind = moving.role === 'center' && peer.role === 'center' ? 'center' : 'edge';
      const rank = kind === 'center' ? 1 : 0;
      if (!best || distance < best.distance || (distance === best.distance && rank < best.rank)) {
        best = { delta, guide: peer.value, distance, kind, rank };
      }
    }
  }
  return best;
}

function nearestEqualSpacing(current, peers, axis, tolerance) {
  const startKey = axis === 'x' ? 'x' : 'y';
  const sizeKey = axis === 'x' ? 'width' : 'height';
  const currentStart = current[startKey];
  const currentSize = current[sizeKey];
  const currentEnd = currentStart + currentSize;
  const before = peers
    .map(peer => ({ start: peer[startKey], end: peer[startKey] + peer[sizeKey] }))
    .filter(peer => peer.end <= currentEnd + tolerance)
    .sort((a, b) => b.end - a.end);
  const after = peers
    .map(peer => ({ start: peer[startKey], end: peer[startKey] + peer[sizeKey] }))
    .filter(peer => peer.start >= currentStart - tolerance)
    .sort((a, b) => a.start - b.start);

  let best = null;
  for (const left of before) {
    for (const right of after) {
      if (left.end >= right.start) continue;
      const available = right.start - left.end - currentSize;
      if (available < 0) continue;
      const desiredGap = available / 2;
      const desiredStart = left.end + desiredGap;
      const rawDelta = desiredStart - currentStart;
      if (Math.abs(rawDelta) > tolerance) continue;
      const delta = Math.round(rawDelta);
      const snappedStart = currentStart + delta;
      const gapBefore = snappedStart - left.end;
      const gapAfter = right.start - (snappedStart + currentSize);
      const residual = Math.abs(gapBefore - gapAfter);
      if (residual > 1.01 || gapBefore < 0 || gapAfter < 0) continue;
      const distance = Math.abs(rawDelta);
      if (!best || distance < best.distance || (distance === best.distance && desiredGap < best.gap)) {
        best = {
          delta,
          distance,
          beforeEdge: left.end,
          afterEdge: right.start,
          gap: desiredGap
        };
      }
    }
  }
  return best;
}

function materializeSpacing(match, start, size) {
  const end = start + size;
  const beforeGap = start - match.beforeEdge;
  const afterGap = match.afterEdge - end;
  return {
    beforeEdge: match.beforeEdge,
    afterEdge: match.afterEdge,
    start,
    end,
    gap: Math.round(((beforeGap + afterGap) / 2) * 10) / 10,
    beforeGap,
    afterGap
  };
}
