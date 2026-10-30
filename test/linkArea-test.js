import assert from "node:assert/strict";
import {test} from "node:test";
import {curveLinear} from "d3-shape";
import {linkAreaHorizontal, linkAreaVertical} from "../src/index.js";

function points(d) {
  return d.replace(/[MZ]/g, "").split("L").map(p => p.split(",").map(Number));
}

function near(a, b, e = 1e-6) {
  assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);
}

function distanceToPolyline(p, line) {
  let min = Infinity;
  for (let i = 0; i < line.length - 1; ++i) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)));
    min = Math.min(min, Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy));
  }
  return min;
}

function segmentsCross(line) {
  for (let i = 0; i < line.length - 1; ++i) {
    for (let j = i + 2; j < line.length - 1; ++j) {
      const [a, b, c, d] = [line[i], line[i + 1], line[j], line[j + 1]];
      const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
      if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return true;
    }
  }
  return false;
}

test("linkAreaHorizontal() has the expected defaults", () => {
  const l = linkAreaHorizontal();
  assert.equal(l.source()({source: 1}), 1);
  assert.equal(l.target()({target: 2}), 2);
  assert.equal(l.x()([1, 2, 3]), 1);
  assert.equal(l.y()([1, 2, 3]), 2);
  assert.equal(l.width()([1, 2, 3]), 3);
  assert.equal(l.curvature(), 0.5);
  assert.equal(l.context(), null);
});

test("linkAreaHorizontal() returns a closed path string", () => {
  const d = linkAreaHorizontal()({source: [0, 0, 10], target: [100, 50, 10]});
  assert.match(d, /^M.*Z$/);
});

test("linkAreaHorizontal() meets the nodes with vertical cuts", () => {
  const p = points(linkAreaHorizontal().curve(curveLinear)({source: [0, 20, 10], target: [100, 80, 30]}));
  const n = p.length / 2;
  near(p[0][0], 0), near(p[0][1], 15);
  near(p[n - 1][0], 100), near(p[n - 1][1], 65);
  near(p[n][0], 100), near(p[n][1], 95);
  near(p[2 * n - 1][0], 0), near(p[2 * n - 1][1], 25);
});

test("linkAreaHorizontal() keeps a constant perpendicular thickness", () => {
  const l = linkAreaHorizontal().curve(curveLinear).samples(200);
  const p = points(l({source: [0, 0, 20], target: [100, 150, 20]}));
  const n = p.length / 2, side0 = p.slice(0, n), side1 = p.slice(n);
  // The centerline midpoint is the steepest point of the curve.
  const mid = [50, 75];
  near(distanceToPolyline(mid, side0), 10, 0.05);
  near(distanceToPolyline(mid, side1), 10, 0.05);
});

test("linkAreaVertical() swaps the axes", () => {
  const p = points(linkAreaVertical().curve(curveLinear)({source: [20, 0, 10], target: [80, 100, 30]}));
  const n = p.length / 2;
  near(p[0][0], 15), near(p[0][1], 0);
  near(p[n - 1][0], 65), near(p[n - 1][1], 100);
  near(p[n][0], 95), near(p[n][1], 100);
  near(p[2 * n - 1][0], 25), near(p[2 * n - 1][1], 0);
});

test("linkAreaHorizontal() removes the fold of wide, steep flows", () => {
  const l = linkAreaHorizontal().curve(curveLinear).samples(64);
  const p = points(l({source: [0, 0, 80], target: [60, 200, 80]}));
  assert.equal(segmentsCross(p), false);
});

test("linkAreaHorizontal() never pokes behind the nodes", () => {
  for (const [x0, x1] of [[0, 60], [60, 0]]) {
    const l = linkAreaHorizontal().curve(curveLinear).samples(64);
    const p = points(l({source: [x0, 0, 80], target: [x1, 200, 80]}));
    for (const [x] of p) assert.ok(x >= -1e-9 && x <= 60 + 1e-9, `x = ${x}`);
    assert.equal(segmentsCross(p), false);
  }
});

test("linkAreaHorizontal() rounds trimmed folds into the nodes", () => {
  const l = linkAreaHorizontal().curve(curveLinear);
  const p = points(l({source: [195.5, 40, 120], target: [284.5, 360, 42]}));
  const n = p.findIndex(q => q[0] === 284.5 && q[1] === 339);
  // The edge reaches the target's corner moving right and down, with no step.
  for (let i = n - 12; i < n; ++i) {
    assert.ok(p[i + 1][0] >= p[i][0] - 1e-9, `x goes back at ${p[i]}`);
    assert.ok(p[i + 1][1] >= p[i][1] - 1e-9, `y goes back at ${p[i]}`);
  }
  assert.equal(segmentsCross(p), false);
});

test("linkAreaHorizontal() leaves a node along its side when the flow can't fit", () => {
  const l = linkAreaHorizontal().curve(curveLinear);
  const p = points(l({source: [195.5, 40, 120], target: [284.5, 360, 42]}));
  // The bottom edge, walked away from the source's bottom corner, never bulges
  // out and back: it only moves right and down.
  const edge = p.slice(-20).reverse();
  assert.deepEqual(edge[0], [195.5, 100]);
  for (let i = 0; i < edge.length - 1; ++i) {
    assert.ok(edge[i + 1][0] >= edge[i][0] - 1e-9, `x goes back at ${edge[i]}`);
    assert.ok(edge[i + 1][1] >= edge[i][1] - 1e-9, `y goes back at ${edge[i]}`);
  }
});

test("linkAreaHorizontal().fillet(0) leaves the trimmed corners sharp", () => {
  const l = linkAreaHorizontal().curve(curveLinear).fillet(0);
  const p = points(l({source: [195.5, 40, 120], target: [284.5, 360, 42]}));
  assert.ok(p.some(q => q[0] === 195.5 && q[1] > 150));
});

test("linkAreaHorizontal() leaves flows without folds untouched by the fillet", () => {
  const d = {source: [0, 0, 20], target: [300, 100, 30]};
  assert.equal(linkAreaHorizontal().fillet(0)(d), linkAreaHorizontal()(d));
});

function cubics(d) {
  const tokens = d.match(/[MCLZ]|-?[\d.]+(?:e-?\d+)?/g), out = [];
  let cmd, p = null, nums = [];
  for (const tok of tokens) {
    if (/[MCLZ]/.test(tok)) cmd = tok, nums = [];
    else nums.push(+tok);
    if ((cmd === "M" || cmd === "L") && nums.length === 2) p = nums, nums = [];
    if (cmd === "C" && nums.length === 6) {
      out.push([p, nums.slice(0, 2), nums.slice(2, 4), nums.slice(4, 6)]);
      p = nums.slice(4, 6), nums = [];
    }
  }
  return out;
}

function bezierPoint([p0, p1, p2, p3], t) {
  const mt = 1 - t;
  return [0, 1].map(k => mt * mt * mt * p0[k] + 3 * mt * mt * t * p1[k] + 3 * mt * t * t * p2[k] + t * t * t * p3[k]);
}

function maxDeviation(d, reference) {
  let max = 0;
  for (const c of cubics(d)) {
    for (let i = 0; i <= 20; ++i) max = Math.max(max, distanceToPolyline(bezierPoint(c, i / 20), reference));
  }
  return max;
}

test("linkAreaHorizontal() fits each edge with few cubics", () => {
  const d = linkAreaHorizontal()({source: [0, 0, 50], target: [300, 200, 50]});
  assert.ok(cubics(d).length <= 8, `${cubics(d).length} cubics`);
});

test("linkAreaHorizontal() fits within the tolerance", () => {
  for (const [s, t] of [
    [[0, 0, 50], [300, 200, 50]],
    [[0, 0, 10], [120, 300, 60]],
    [[195.5, 40, 120], [284.5, 360, 42]]
  ]) {
    const reference = points(linkAreaHorizontal().curve(curveLinear).samples(1024)({source: s, target: t}));
    reference.push(reference[0]);
    // Dense samples, so this measures the fitting and not the sampling.
    const d = linkAreaHorizontal().samples(256)({source: s, target: t});
    assert.ok(maxDeviation(d, reference) <= 0.25 * 1.05, `deviation ${maxDeviation(d, reference)}`);
  }
});

test("linkAreaHorizontal().tolerance(t) trades nodes for accuracy", () => {
  const d = {source: [0, 0, 10], target: [120, 300, 60]};
  const fine = cubics(linkAreaHorizontal().tolerance(0.01)(d)).length;
  const coarse = cubics(linkAreaHorizontal().tolerance(1)(d)).length;
  assert.ok(coarse < fine, `${coarse} vs ${fine}`);
});

test("linkAreaHorizontal() accepts accessors and constants", () => {
  const l = linkAreaHorizontal()
    .source(d => [d.source.x1, d.y0])
    .target(d => [d.target.x0, d.y1])
    .width(12)
    .curve(curveLinear);
  const p = points(l({source: {x1: 10}, target: {x0: 90}, y0: 30, y1: 30}));
  near(p[0][1], 24);
  near(p[p.length - 1][1], 36);
});

test("linkAreaHorizontal() passes extra arguments to the accessors", () => {
  const seen = [];
  const l = linkAreaHorizontal().width((p, i) => (seen.push(i), 4));
  l({source: [0, 0], target: [10, 10]}, 7);
  assert.deepEqual(seen, [7, 7]);
});

test("linkAreaHorizontal().context(context) draws to the given context", () => {
  const calls = [];
  const context = {
    moveTo: (x, y) => calls.push("moveTo"),
    lineTo: (x, y) => calls.push("lineTo"),
    bezierCurveTo: () => calls.push("bezierCurveTo"),
    closePath: () => calls.push("closePath")
  };
  const l = linkAreaHorizontal().context(context);
  assert.equal(l({source: [0, 0, 10], target: [100, 50, 10]}), undefined);
  assert.equal(calls[0], "moveTo");
  assert.equal(calls[calls.length - 1], "closePath");
});
