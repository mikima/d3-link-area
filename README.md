# d3-link-area

Links drawn as areas, for D3: the filled counterpart of [`d3.link`](https://d3js.org/d3-shape/link), as `d3.area` is of `d3.line`. Use it for the bands of Sankey diagrams, alluvial diagrams and parallel sets, drawn as **closed paths** that keep a constant perpendicular thickness and can **change width from source to target**.

## The problem

The usual way to draw a filled flow is to take one cubic Bézier for the top edge and the same curve shifted down by the flow's width for the bottom edge. The band is then constant in *vertical* thickness, but the eye reads thickness *across* the flow: where the curve is steep, the band looks pinched (by a factor of cos θ).

The other common approach, a centerline drawn with a thick `stroke-width` (as `d3.sankeyLinkHorizontal` does), has the right thickness, but it isn't a fillable shape and it can't change width along the way.

`d3-link-area` offsets the two edges perpendicularly to the same centerline used by [`d3.linkHorizontal`](https://d3js.org/d3-shape/link), interpolating the width from source to target. You get a single closed path you can fill, stroke, hover or clip, at a thickness that matches the data.

## Installing

```sh
npm install d3-link-area
```

```js
import {linkAreaHorizontal, linkAreaVertical} from "d3-link-area";
```

Or in the browser, after D3:

```html
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<script src="https://cdn.jsdelivr.net/npm/d3-link-area@0.1"></script>
<script>
  const link = d3.linkAreaHorizontal();
</script>
```

## Usage

The API mirrors [d3-shape links](https://d3js.org/d3-shape/link). A point is `[x, y, width]` by default, where `y` is the *center* of the band at that end:

```js
const link = linkAreaHorizontal();
link({source: [100, 50, 20], target: [400, 200, 40]}); // "M100,40C…Z"
```

With [d3-sankey](https://github.com/d3/d3-sankey):

```js
const link = linkAreaHorizontal()
    .source(d => [d.source.x1, d.y0, d.width])
    .target(d => [d.target.x0, d.y1, d.width]);

svg.append("g")
  .selectAll("path")
  .data(links)
  .join("path")
    .attr("d", link)
    .attr("fill", d => color(d.source.id));
```

Note the `fill` instead of `stroke` / `stroke-width`.

## API

<a name="linkAreaHorizontal" href="#linkAreaHorizontal">#</a> <b>linkAreaHorizontal</b>()

Returns a new link area generator for flows going left to right (or right to left). The ends of the band are vertical cuts that meet the node edges.

<a name="linkAreaVertical" href="#linkAreaVertical">#</a> <b>linkAreaVertical</b>()

Same, for flows going top to bottom (or bottom to top). The ends are horizontal cuts.

<a name="_link" href="#_link">#</a> <i>link</i>(<i>arguments…</i>)

Generates the band for the given *arguments*, which are passed to the accessors along with `this`. Returns a path data string, or draws to the [context](#link_context) and returns undefined.

<a name="link_source" href="#link_source">#</a> <i>link</i>.<b>source</b>([<i>source</i>])
<br><a name="link_target" href="#link_target">#</a> <i>link</i>.<b>target</b>([<i>target</i>])

Accessors for the two ends. Default to `d => d.source` and `d => d.target`.

<a name="link_x" href="#link_x">#</a> <i>link</i>.<b>x</b>([<i>x</i>])
<br><a name="link_y" href="#link_y">#</a> <i>link</i>.<b>y</b>([<i>y</i>])

Accessors for the position of each end, called with the value returned by the source or target accessor. Default to `p => p[0]` and `p => p[1]`. The position is the center of the band.

<a name="link_width" href="#link_width">#</a> <i>link</i>.<b>width</b>([<i>width</i>])

Accessor for the thickness of the band at each end, measured along the node edge. Defaults to `p => p[2]`. Can be a constant.

<a name="link_curvature" href="#link_curvature">#</a> <i>link</i>.<b>curvature</b>([<i>curvature</i>])

How far the Bézier control points reach toward the other end, from 0 to 1. Defaults to 0.5, the same curve as `d3.linkHorizontal`. Lower values make the flow leave the node more steeply.

<a name="link_ease" href="#link_ease">#</a> <i>link</i>.<b>ease</b>([<i>ease</i>])

The easing of the width transition between source and target. Defaults to smoothstep, so the band keeps the node's width as it leaves and enters. Any [d3-ease](https://d3js.org/d3-ease) function works, for example `d3.easeLinear` for a straight taper.

<a name="link_samples" href="#link_samples">#</a> <i>link</i>.<b>samples</b>([<i>samples</i>])

The number of segments each edge is sampled into before trimming and fitting. Defaults to 64. More samples follow very tight bends more closely; they cost computation, not nodes in the output.

<a name="link_tolerance" href="#link_tolerance">#</a> <i>link</i>.<b>tolerance</b>([<i>tolerance</i>])

The maximum distance, in the same units as the coordinates, between the output and the sampled outline. Each edge is drawn with as few cubic Béziers as this allows, typically two to four for an ordinary flow, so the paths stay light and easy to edit in a vector editor. Defaults to 0.25. Raise it for fewer nodes, lower it for more accuracy.

<a name="link_fillet" href="#link_fillet">#</a> <i>link</i>.<b>fillet</b>([<i>fillet</i>])

How much to round the corners left where folds are trimmed away (see [below](#wide-tight-flows)), relative to the size of the fold. Defaults to 1; 0 leaves sharp corners.

<a name="link_curve" href="#link_curve">#</a> <i>link</i>.<b>curve</b>([<i>curve</i>])

If set, the sampled edges are drawn through this [curve](https://d3js.org/d3-shape/curve) instead of being fitted with cubics, for example `d3.curveLinear` for a polygon through every sample. Defaults to null.

<a name="link_context" href="#link_context">#</a> <i>link</i>.<b>context</b>([<i>context</i>])

If *context* is set, the generator draws to it (for example a `CanvasRenderingContext2D`) instead of returning a string. Defaults to null.

## Wide, tight flows

When half a band's width is larger than the curve's radius of curvature, its inner edge would fold onto itself (the "swallowtail" of offset curves) and poke behind the node. The generator trims those folds: the outline never goes past the source or target node, and it never crosses itself.

Every trimmed corner is then rounded with a fillet tangent to the edge on both sides. At the nodes, the edge leaves and enters along the direction of the flow; when the fold is so deep that this would make the edge bulge out and back, it runs along the side of the node instead. The fillet is sized on the fold, so slight folds get slight rounding, and it is widened where needed so that it never bulges outward. Set [`fillet`](#link_fillet) to tune it.

If a band is so wide that its steep middle part doesn't fit between the nodes at all, its edges run along the node edges there. No band can be both constant in thickness and that tight, so leave more room between the columns, or lower the `curvature`.

## Demo

```sh
npm install
python3 -m http.server
```

Then open <http://localhost:8000/demo/>.

## License

ISC
