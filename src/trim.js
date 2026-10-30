// Trimming of the offset edges. When half the band width exceeds the
// centerline's radius of curvature, the offset folds back on itself: near the
// nodes the fold pokes behind the node, elsewhere it makes a closed loop (a
// "swallowtail"). Both are cut away, and every cut is then replaced by a
// fillet tangent to the edge on both sides, so no corner is left behind.
//
// Points are [u, v, h], with u along the flow and h the local half-width;
// u0 and u1 are the positions of the source and target nodes; folded says
// whether the edge may loop (the costly check is skipped otherwise).
export default function trim(points, u0, u1, fillet = 1, folded = true) {
  const lo = Math.min(u0, u1), hi = Math.max(u0, u1), direction = u1 < u0 ? -1 : 1;
  const clipped = clip(points, lo, hi);
  const out = smooth(folded ? loops(clipped) : clipped, direction, fillet);
  for (const p of out) p[0] = Math.max(lo, Math.min(hi, p[0]));
  return out;
}

function lerp(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function distance(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

// A cut point carries, as its fourth value, the size of what was cut there.
function cut(p, size) {
  return p[3] = size, p;
}

// Clip the polyline to the slab between the nodes; where it leaves the slab
// it runs along the node's edge until it comes back in. The size of the cut
// is the length of that run.
function clip(points, lo, hi) {
  const inside = p => p[0] >= lo && p[0] <= hi,
        cross = (a, b, u) => lerp(a, b, (u - a[0]) / (b[0] - a[0])),
        enter = p => (exit && (cut(exit, distance(exit, p)), cut(p, exit[3])), exit = null, p);
  const out = [points[0]];
  let exit = null;
  for (let i = 1; i < points.length; ++i) {
    const a = points[i - 1], b = points[i], ia = inside(a), ib = inside(b);
    if (ia && ib) out.push(b);
    else if (ia) out.push(exit = cross(a, b, b[0] < lo ? lo : hi));
    else if (ib) out.push(enter(cross(a, b, a[0] < lo ? lo : hi)), b);
    else if ((a[0] < lo) !== (b[0] < lo)) {
      out.push(enter(cross(a, b, a[0] < lo ? lo : hi)), exit = cross(a, b, b[0] < lo ? lo : hi));
    }
  }
  return out;
}

// Whenever a segment crosses a later one, cut the loop at the crossing point.
// The size of the cut is half the length of the loop.
function loops(points) {
  const n = points.length, out = [points[0]];
  for (let i = 0; i < n - 1; ++i) {
    for (let j = n - 2; j > i + 1; --j) {
      const k = intersect(points[i], points[i + 1], points[j], points[j + 1]);
      if (k !== null) {
        let size = 0;
        for (let l = i + 1; l < j; ++l) size += distance(points[l], points[l + 1]);
        out.push(cut(lerp(points[i], points[i + 1], k), size / 2)), i = j;
        break;
      }
    }
    out.push(points[i + 1]);
  }
  return out;
}

function intersect(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1],
        sx = d[0] - c[0], sy = d[1] - c[1],
        den = rx * sy - ry * sx;
  if (!den) return null;
  const qx = c[0] - a[0], qy = c[1] - a[1],
        t = (qx * sy - qy * sx) / den,
        u = (qx * ry - qy * rx) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? t : null;
}

// Replace the stretch of edge around each cut with a curve tangent to the
// edge at both ends; at the nodes the tangent is the direction of the flow,
// so the edge leaves and enters the node smoothly. Each cut is rounded over
// half its size (at most half the local half-width) times the fillet factor
// on either side. When the two tangents don't meet inside the corner, which
// would make the curve bulge out, the stretch is widened away from the nodes
// until they do.
function smooth(points, direction, fillet) {
  const n = points.length, s = new Float64Array(n);
  for (let i = 1; i < n; ++i) s[i] = s[i - 1] + distance(points[i - 1], points[i]);
  const length = s[n - 1];

  let windows = [];
  for (let i = 0; i < n; ++i) {
    if (!(points[i][3] > 0) || !(fillet > 0)) continue;
    const r = Math.min(points[i][3], points[i][2]) / 2 * fillet;
    windows.push([Math.max(0, s[i] - r), Math.min(length, s[i] + r), r]);
  }
  if (!windows.length) return points;

  const at = d => {
    let i = 1;
    while (i < n - 1 && s[i] < d) ++i;
    return lerp(points[i - 1], points[i], s[i] > s[i - 1] ? (d - s[i - 1]) / (s[i] - s[i - 1]) : 0);
  };

  // Unit tangent at arc length d, looking ahead (or back) for a segment of non-zero length.
  // At the nodes it is the direction of the flow or, with face, the direction
  // along the node's side in which the edge moves away from (or into) the node.
  const tangent = (d, ahead, face) => {
    if (d <= 0 || d >= length) {
      if (!face) return [direction, 0];
      const e = points[d <= 0 ? 0 : n - 1];
      let k = d <= 0 ? 1 : n - 2;
      while (k > 0 && k < n - 1 && Math.abs(points[k][1] - e[1]) < 1e-9) d <= 0 ? ++k : --k;
      const sv = Math.sign(points[k][1] - e[1]) || 1;
      return [0, d <= 0 ? sv : -sv];
    }
    let i = 1;
    while (i < n - 1 && s[i] < d) ++i;
    let j = i;
    while (s[j] - s[j - 1] <= 1e-9 && (ahead ? j < n - 1 : j > 1)) ahead ? ++j : --j;
    const du = points[j][0] - points[j - 1][0], dv = points[j][1] - points[j - 1][1], l = Math.hypot(du, dv) || 1;
    return [du / l, dv / l];
  };

  // Where the tangents at a and b meet, as distances ahead of a and behind b;
  // null unless they meet inside the corner, not too far out.
  const corner = (a, b, ta, tb) => {
    const ab = [b[0] - a[0], b[1] - a[1]],
          den = ta[0] * tb[1] - ta[1] * tb[0],
          p = den && (ab[0] * tb[1] - ab[1] * tb[0]) / den,
          q = den && -(ab[0] * ta[1] - ab[1] * ta[0]) / den,
          l = distance(a, b) * 2;
    return p > 0 && q > 0 && p < l && q < l ? [p, q] : null;
  };
  const fits = ([da, db], face) => corner(at(da), at(db), tangent(da, true, face), tangent(db, false, face));

  const merge = () => {
    windows.sort((a, b) => a[0] - b[0]);
    const merged = [windows[0]];
    for (const w of windows.slice(1)) {
      const last = merged[merged.length - 1];
      if (w[0] <= last[1]) last[1] = Math.max(last[1], w[1]), last[2] = Math.max(last[2], w[2]), last[3] = last[4] = false;
      else merged.push(w);
    }
    windows = merged;
  };

  merge();
  for (let pass = 0, changed = true; changed && pass < 8; ++pass) {
    changed = false;
    for (const w of windows) {
      if (w[3]) continue;
      // At a node, first try leaving along the flow; if that can't fit, along
      // the node's side, as when the edge runs down the side of the node.
      const node = w[0] <= 0 || w[1] >= length;
      for (const face of node ? [false, true] : [false]) {
        if (fits(w, face)) {
          w[3] = true, w[4] = face;
          break;
        }
        const step = w[2] / 2 || 1, max = length / 2;
        for (let e = step; e <= max; e += step) {
          const da = w[0] > 0 ? Math.max(0, w[0] - e) : 0,
                db = w[1] < length ? Math.min(length, w[1] + e) : length;
          if (da === w[0] && db === w[1]) break;
          if (fits([da, db], face)) {
            w[0] = da, w[1] = db, w[3] = true, w[4] = face, changed = true;
            break;
          }
        }
        if (w[3]) break;
      }
      if (!w[3]) w[4] = node;
    }
    if (changed) merge();
  }

  const out = [];
  for (let i = 0, w = 0; i < n; ++i) {
    while (windows[w] && s[i] >= windows[w][0]) out.push(...bezier(windows[w++]));
    if (!(s[i] <= windows[w - 1]?.[1])) out.push(points[i]);
  }
  return out;

  // The control points sit two thirds of the way to where the tangents meet,
  // so the curve stays inside the corner it rounds. If they can't, fall back
  // to a third of the chord.
  function bezier([da, db, , , face]) {
    const a = at(da), b = at(db),
          ta = tangent(da, true, face), tb = tangent(db, false, face),
          pq = corner(a, b, ta, tb),
          ca = pq ? pq[0] * 2 / 3 : distance(a, b) / 3,
          cb = pq ? pq[1] * 2 / 3 : distance(a, b) / 3,
          m = 12, curve = [];
    for (let k = 0; k <= m; ++k) {
      const t = k / m, mt = 1 - t,
            b0 = mt * mt * mt, b1 = 3 * mt * mt * t, b2 = 3 * mt * t * t, b3 = t * t * t;
      curve.push([
        b0 * a[0] + b1 * (a[0] + ta[0] * ca) + b2 * (b[0] - tb[0] * cb) + b3 * b[0],
        b0 * a[1] + b1 * (a[1] + ta[1] * ca) + b2 * (b[1] - tb[1] * cb) + b3 * b[1],
        a[2] + (b[2] - a[2]) * t
      ]);
    }
    return curve;
  }
}
