import {path} from "d3-path";
import fit from "./fit.js";
import trim from "./trim.js";

function constant(x) {
  return function() {
    return x;
  };
}

function linkSource(d) {
  return d.source;
}

function linkTarget(d) {
  return d.target;
}

function pointX(p) {
  return p[0];
}

function pointY(p) {
  return p[1];
}

function pointWidth(p) {
  return p[2];
}

// Smoothstep: zero slope at both ends, so the band keeps the node's width
// while it leaves the source and enters the target.
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

// Generates the outline of a filled flow between two points. The centerline
// is the same cubic Bézier as d3.linkHorizontal / d3.linkVertical; the edges
// are offset perpendicularly to it, so the band keeps its visual thickness
// where the flow is steep, and can change width from source to target.
//
// Internally everything is computed on a (u, v) frame where u is the
// direction of the flow (x for horizontal, y for vertical).
function linkArea(vertical) {
  let source = linkSource,
      target = linkTarget,
      x = pointX,
      y = pointY,
      width = pointWidth,
      curvature = 0.5,
      samples = 64,
      ease = smoothstep,
      tolerance = 0.25,
      curve = null,
      fillet = 1,
      context = null;

  function link() {
    let buffer;
    const argv = Array.prototype.slice.call(arguments);
    const s = source.apply(this, argv);
    const t = target.apply(this, argv);

    argv[0] = s;
    const sx = +x.apply(this, argv), sy = +y.apply(this, argv), sw = +width.apply(this, argv);
    argv[0] = t;
    const tx = +x.apply(this, argv), ty = +y.apply(this, argv), tw = +width.apply(this, argv);

    const u0 = vertical ? sy : sx, v0 = vertical ? sx : sy,
          u1 = vertical ? ty : tx, v1 = vertical ? tx : ty;

    // Control points: P0=(u0,v0) P1=(c0,v0) P2=(c1,v1) P3=(u1,v1).
    const c0 = u0 + (u1 - u0) * curvature,
          c1 = u1 - (u1 - u0) * curvature;

    const n = Math.max(2, Math.round(samples)),
          side0 = new Array(n + 1),
          side1 = new Array(n + 1);

    // An edge folds where it runs against the centerline; only then does it
    // need to be checked for loops.
    let fold0 = false, fold1 = false, pu, pv;

    for (let i = 0; i <= n; ++i) {
      const k = i / n, mk = 1 - k;

      // Point on the centerline.
      const u = mk * mk * mk * u0 + 3 * mk * mk * k * c0 + 3 * mk * k * k * c1 + k * k * k * u1,
            v = mk * mk * mk * v0 + 3 * mk * mk * k * v0 + 3 * mk * k * k * v1 + k * k * k * v1;

      // Tangent; for degenerate curves (u0 === u1) fall back to the chord.
      let du = 3 * mk * mk * (c0 - u0) + 6 * mk * k * (c1 - c0) + 3 * k * k * (u1 - c1),
          dv = 6 * mk * k * (v1 - v0);
      if (!du && !dv) du = u1 - u0, dv = v1 - v0;
      if (!du && !dv) du = 1;
      const l = Math.hypot(du, dv);

      // Unit normal, scaled by half the interpolated width.
      const h = (sw + (tw - sw) * ease(k)) / 2,
            nu = -dv / l * h,
            nv = du / l * h;

      side0[i] = [u - nu, v - nv, h];
      side1[i] = [u + nu, v + nv, h];

      if (i) {
        const cu = u - pu, cv = v - pv, a = side0[i - 1], b = side1[i - 1];
        if ((side0[i][0] - a[0]) * cu + (side0[i][1] - a[1]) * cv <= 0) fold0 = true;
        if ((side1[i][0] - b[0]) * cu + (side1[i][1] - b[1]) * cv <= 0) fold1 = true;
      }
      pu = u, pv = v;
    }

    const a = trim(side0, u0, u1, fillet, fold0), b = trim(side1, u0, u1, fillet, fold1).reverse();

    if (!context) context = buffer = path();

    // By default each edge is fitted with as few cubics as the tolerance
    // allows; with an explicit curve, the samples are drawn through it.
    if (curve) {
      const output = curve(context);
      output.areaStart();
      output.lineStart();
      for (const p of a) vertical ? output.point(p[1], p[0]) : output.point(p[0], p[1]);
      output.lineEnd();
      output.lineStart();
      for (const p of b) vertical ? output.point(p[1], p[0]) : output.point(p[0], p[1]);
      output.lineEnd();
      output.areaEnd();
    } else {
      const xy = p => vertical ? [p[1], p[0]] : [p[0], p[1]];
      const edge = (points, move) => {
        const p = xy(points[0]);
        move ? context.moveTo(p[0], p[1]) : context.lineTo(p[0], p[1]);
        for (const [, p1, p2, p3] of fit(points, tolerance)) {
          const c1 = xy(p1), c2 = xy(p2), e = xy(p3);
          context.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
        }
      };
      edge(a, true);
      edge(b, false);
      context.closePath();
    }

    if (buffer) return context = null, buffer + "" || null;
  }

  link.source = function(_) {
    return arguments.length ? (source = _, link) : source;
  };

  link.target = function(_) {
    return arguments.length ? (target = _, link) : target;
  };

  link.x = function(_) {
    return arguments.length ? (x = typeof _ === "function" ? _ : constant(+_), link) : x;
  };

  link.y = function(_) {
    return arguments.length ? (y = typeof _ === "function" ? _ : constant(+_), link) : y;
  };

  link.width = function(_) {
    return arguments.length ? (width = typeof _ === "function" ? _ : constant(+_), link) : width;
  };

  link.curvature = function(_) {
    return arguments.length ? (curvature = +_, link) : curvature;
  };

  link.samples = function(_) {
    return arguments.length ? (samples = +_, link) : samples;
  };

  link.ease = function(_) {
    return arguments.length ? (ease = _, link) : ease;
  };

  link.fillet = function(_) {
    return arguments.length ? (fillet = +_, link) : fillet;
  };

  link.tolerance = function(_) {
    return arguments.length ? (tolerance = +_, link) : tolerance;
  };

  link.curve = function(_) {
    return arguments.length ? (curve = _, link) : curve;
  };

  link.context = function(_) {
    return arguments.length ? (context = _ == null ? null : _, link) : context;
  };

  return link;
}

export function linkAreaHorizontal() {
  return linkArea(false);
}

export function linkAreaVertical() {
  return linkArea(true);
}
