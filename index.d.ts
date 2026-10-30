/** A d3-shape curve factory, such as d3.curveLinear. */
export type CurveFactory = (context: any) => {
  areaStart(): void; areaEnd(): void; lineStart(): void; lineEnd(): void; point(x: number, y: number): void;
};

export interface LinkAreaContext {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  closePath(): void;
}

/** A point is [x, y, width] by default; y (or x, if vertical) is the center of the band. */
export type LinkAreaPoint = [number, number, number];

export interface LinkArea<This, Link, Node> {
  (this: This, d: Link, ...args: any[]): string | null;
  (this: This, d: Link, ...args: any[]): void;

  source(): (this: This, d: Link, ...args: any[]) => Node;
  source(source: (this: This, d: Link, ...args: any[]) => Node): this;

  target(): (this: This, d: Link, ...args: any[]) => Node;
  target(target: (this: This, d: Link, ...args: any[]) => Node): this;

  x(): (this: This, node: Node, ...args: any[]) => number;
  x(x: number | ((this: This, node: Node, ...args: any[]) => number)): this;

  y(): (this: This, node: Node, ...args: any[]) => number;
  y(y: number | ((this: This, node: Node, ...args: any[]) => number)): this;

  /** Thickness of the band at the source and target, measured across the node edge. */
  width(): (this: This, node: Node, ...args: any[]) => number;
  width(width: number | ((this: This, node: Node, ...args: any[]) => number)): this;

  /** Horizontal (or vertical) reach of the control points, from 0 to 1. Defaults to 0.5. */
  curvature(): number;
  curvature(curvature: number): this;

  /** Number of segments used to sample each edge before trimming and fitting. Defaults to 64. */
  samples(): number;
  samples(samples: number): this;

  /** Easing applied to the width transition; any d3-ease function works. Defaults to smoothstep. */
  ease(): (t: number) => number;
  ease(ease: (t: number) => number): this;

  /** Size of the rounding where folds are trimmed away, relative to the fold; 0 leaves sharp corners. Defaults to 1. */
  fillet(): number;
  fillet(fillet: number): this;

  /** Maximum distance between the fitted cubics and the sampled outline. Defaults to 0.25. */
  tolerance(): number;
  tolerance(tolerance: number): this;

  /** If set, the samples are drawn through this curve instead of being fitted with cubics. Defaults to null. */
  curve(): CurveFactory | null;
  curve(curve: CurveFactory | null): this;

  context(): LinkAreaContext | null;
  context(context: LinkAreaContext | null): this;
}

export interface DefaultLinkAreaObject {
  source: LinkAreaPoint;
  target: LinkAreaPoint;
}

export function linkAreaHorizontal(): LinkArea<any, DefaultLinkAreaObject, LinkAreaPoint>;
export function linkAreaHorizontal<Link, Node>(): LinkArea<any, Link, Node>;
export function linkAreaHorizontal<This, Link, Node>(): LinkArea<This, Link, Node>;

export function linkAreaVertical(): LinkArea<any, DefaultLinkAreaObject, LinkAreaPoint>;
export function linkAreaVertical<Link, Node>(): LinkArea<any, Link, Node>;
export function linkAreaVertical<This, Link, Node>(): LinkArea<This, Link, Node>;
