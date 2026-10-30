// Fits a polyline with as few cubic Béziers as possible, within a maximum
// distance (tolerance) from its points. Each cubic is fitted by least squares
// along fixed end tangents, with Newton–Raphson reparameterization, as in
// Philip J. Schneider's "An Algorithm for Automatically Fitting Digitized
// Curves" (Graphics Gems, 1990). Rather than splitting at the worst point,
// each cubic reaches as far along the polyline as it can (found by binary
// search), which gives fewer cubics for the smooth edges of a flow.
//
// Corners sharper than the given angle are kept as corners: the polyline is
// split there and each run is fitted on its own.
//
// Returns an array of cubics, each [p0, p1, p2, p3].
export default function fit(points, tolerance, corner = Math.PI / 4) {
  const d = dedupe(points), out = [];
  if (d.length < 2) return out;
  const cos = Math.cos(corner);
  let start = 0;
  for (let i = 1; i < d.length - 1; ++i) {
    const a = unit(sub(d[i], d[i - 1])), b = unit(sub(d[i + 1], d[i]));
    if (dot(a, b) < cos) fitRun(d.slice(start, i + 1), tolerance, out), start = i;
  }
  fitRun(d.slice(start), tolerance, out);
  return out;
}

function fitRun(d, tolerance, out) {
  const n = d.length - 1, error = tolerance * tolerance;

  // Tangents by central differences; at the ends of the run, by the
  // derivative of the parabola through the first (or last) three points.
  const tangents = d.map((p, i) => unit(sub(d[Math.min(n, i + 1)], d[Math.max(0, i - 1)])));
  if (n > 1) {
    tangents[0] = endTangent(d[0], d[1], d[2]);
    tangents[n] = scale(endTangent(d[n], d[n - 1], d[n - 2]), -1);
  }

  for (let i = 0; i < n;) {
    let lo = i + 1, hi = n, best = i + 1, bez = segment(d, i, i + 1, tangents);
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, b = tryFit(d, i, mid, tangents, error);
      if (b) best = mid, bez = b, lo = mid + 1;
      else hi = mid - 1;
    }
    out.push(bez);
    i = best;
  }
}

// A cubic from d[first] to d[last] within the error, or null.
function tryFit(d, first, last, tangents, error) {
  if (last - first === 1) return segment(d, first, last, tangents);
  const tHat1 = tangents[first], tHat2 = scale(tangents[last], -1);
  let u = chordLengthParameterize(d, first, last),
      bez = generateBezier(d, first, last, u, tHat1, tHat2),
      maxError = computeMaxError(d, first, last, bez, u);
  if (maxError < error) return bez;
  if (maxError < error * 16) {
    for (let k = 0; k < 4; ++k) {
      u = reparameterize(bez, d, first, last, u);
      bez = generateBezier(d, first, last, u, tHat1, tHat2);
      maxError = computeMaxError(d, first, last, bez, u);
      if (maxError < error) return bez;
    }
  }
  return null;
}

// Unit tangent at p0, leaving towards p1, of the parabola through p0, p1, p2
// parameterized by chord length.
function endTangent(p0, p1, p2) {
  const s1 = distance(p0, p1), s2 = s1 + distance(p1, p2);
  if (!(s2 > s1)) return unit(sub(p1, p0));
  const k0 = -(s1 + s2) / (s1 * s2), k1 = s2 / (s1 * (s2 - s1)), k2 = -s1 / (s2 * (s2 - s1));
  return unit(add(add(scale(p0, k0), scale(p1, k1)), scale(p2, k2)));
}

function segment(d, first, last, tangents) {
  const dist = distance(d[first], d[last]) / 3;
  return [d[first], add(d[first], scale(tangents[first], dist)), sub(d[last], scale(tangents[last], dist)), d[last]];
}

// Least-squares control points along the given end tangents.
function generateBezier(d, first, last, u, tHat1, tHat2) {
  const p0 = d[first], p3 = d[last];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;

  for (let i = 0; i <= last - first; ++i) {
    const t = u[i], mt = 1 - t,
          b0 = mt * mt * mt, b1 = 3 * mt * mt * t, b2 = 3 * mt * t * t, b3 = t * t * t,
          a0 = scale(tHat1, b1), a1 = scale(tHat2, b2),
          tmp = sub(d[first + i], add(scale(p0, b0 + b1), scale(p3, b2 + b3)));
    c00 += dot(a0, a0), c01 += dot(a0, a1), c11 += dot(a1, a1);
    x0 += dot(a0, tmp), x1 += dot(a1, tmp);
  }

  const det = c00 * c11 - c01 * c01,
        alphaL = det ? (x0 * c11 - x1 * c01) / det : 0,
        alphaR = det ? (c00 * x1 - c01 * x0) / det : 0,
        segLength = distance(p0, p3),
        epsilon = 1e-6 * segLength;

  // Degenerate or wild solutions fall back to a third of the chord.
  if (alphaL < epsilon || alphaR < epsilon || alphaL > segLength * 2 || alphaR > segLength * 2) {
    const dist = segLength / 3;
    return [p0, add(p0, scale(tHat1, dist)), add(p3, scale(tHat2, dist)), p3];
  }
  return [p0, add(p0, scale(tHat1, alphaL)), add(p3, scale(tHat2, alphaR)), p3];
}

function reparameterize(bez, d, first, last, u) {
  return u.map((t, i) => newtonRaphson(bez, d[first + i], t));
}

function newtonRaphson(q, p, t) {
  const d = sub(point(q, t), p),
        q1 = [0, 1, 2].map(i => scale(sub(q[i + 1], q[i]), 3)),
        q2 = [0, 1].map(i => scale(sub(q1[i + 1], q1[i]), 2)),
        d1 = bernstein(q1, t), d2 = bernstein(q2, t),
        numerator = dot(d, d1),
        denominator = dot(d1, d1) + dot(d, d2);
  if (!denominator) return t;
  return Math.max(0, Math.min(1, t - numerator / denominator));
}

// Squared distance from the cubic to the polyline, at the samples and halfway
// between them, so the tolerance holds along the whole edge.
function computeMaxError(d, first, last, bez, u) {
  let maxDist = 0;
  for (let i = first; i < last; ++i) {
    const k = i - first;
    if (i > first) {
      const v = sub(point(bez, u[k]), d[i]);
      maxDist = Math.max(maxDist, dot(v, v));
    }
    maxDist = Math.max(maxDist, segmentDistance2(point(bez, (u[k] + u[k + 1]) / 2), d[i], d[i + 1]));
  }
  return maxDist;
}

function segmentDistance2(p, a, b) {
  const ab = sub(b, a), l = dot(ab, ab),
        t = l ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l)) : 0,
        v = sub(p, add(a, scale(ab, t)));
  return dot(v, v);
}

function chordLengthParameterize(d, first, last) {
  const u = [0];
  for (let i = first + 1; i <= last; ++i) u.push(u[i - first - 1] + distance(d[i], d[i - 1]));
  const total = u[u.length - 1];
  return u.map(x => x / total);
}

function dedupe(points) {
  const out = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (!q || distance(p, q) > 1e-9) out.push([p[0], p[1]]);
  }
  return out;
}

function point(q, t) {
  const mt = 1 - t;
  return [
    mt * mt * mt * q[0][0] + 3 * mt * mt * t * q[1][0] + 3 * mt * t * t * q[2][0] + t * t * t * q[3][0],
    mt * mt * mt * q[0][1] + 3 * mt * mt * t * q[1][1] + 3 * mt * t * t * q[2][1] + t * t * t * q[3][1]
  ];
}

// Evaluates a Bézier of degree 1 or 2 (the derivatives of a cubic).
function bernstein(q, t) {
  const mt = 1 - t;
  return q.length === 2
    ? add(scale(q[0], mt), scale(q[1], t))
    : add(add(scale(q[0], mt * mt), scale(q[1], 2 * mt * t)), scale(q[2], t * t));
}

function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function scale(a, k) { return [a[0] * k, a[1] * k]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
function distance(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
function unit(a) { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; }
