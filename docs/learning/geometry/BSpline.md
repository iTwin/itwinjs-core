# BSpline Curves

A `BSplineCurve3d` (or `BSplineCurve3dH`) is a curve that (loosely) follows a sequence of control points (poles).

Internally, the curve is a sequence of polynomial curves that join together smoothly. Call each of those separate pieces a _span_.

A BSpline curve of order `k+1` (degree `k`) is defined by:
$$
S(t) = \sum_{i=0}^{n} N_{i,k}(t) P_i
$$
where $P_0$, $P_1$, ..., $P_n$ are `n+1` control points and $N_{i,k}(t)$ are the basis functions defined by the *Cox-de Boor Recursion Formula*:

$$
N_{i,0}(x) =
\begin{cases}
1 & \text{if } t_i \leq t < t_{i+1} \\
0 & \text{otherwise}
\end{cases}
$$
$$
N_{i,j}(t) = \frac{t - t_i}{t_{i+j} - t_i} N_{i,j-1}(t) + \frac{t_{i+j+1} - t}{t_{i+j+1} - t_{i+1}} N_{i+1,j-1}(t)
$$
`t_i`s are called the knots. The basis functions can be written as a triangular scheme:
$$
\begin{array}{ccccccc}
N_{0,0}(t) \rightarrow & N_{0,1}(t)	\rightarrow & \cdots & N_{0,k-1}(t) \rightarrow &  N_{0,k}(t) \\
N_{1,0}(t) \rightarrow & N_{1,1}(t)	\rightarrow & \cdots & N_{1,k-1}(t) \\
\vdots & \vdots \\
N_{n-1,0}(t) 	\rightarrow & N_{n-1,1}(t) \\
N_{n,0}(t)
\end{array}
$$

Please note that we always have:

              order + number of control points = number of knots + 2

## Control Points

The "control point" structure has remarkable properties for computation:

- The curve never leaves the overall xyz range of the control points.
- This bounding property applies from any viewpoint, not just in the coordinate system where they are given.
- Even tighter, the curve is contained within the convex hull of the control points.
- No plane can intersect the curve more often than it intersects the control polygon.
  - that is, the polygon may overestimate the number of intersections (i.e., suggest false intersections), but it never underestimates.
- Inspection of the control polygon gives similar "never underestimate" statements about other properties such as
  - the number of inflections (inflection is a point on the curve where the curvature changes sign).
  - the number of minima and maxima of the curve and its derivatives.
- The use of "weights" on the control points allows a bspline curve to exactly trace circular and elliptic arcs without use of trig functions.
- Each span is affected by `order` controls points: `ctlPoints[i]` through `ctlPoints[i + order - 1]`.

## Order

The `order` of the bspline is the number of control points that are "in effect" over an individual span.

- The first span is controlled by the first `order` control points, i.e., those indexed `0, 1, ..., order-1`.
- The next span is controlled by control points indexed `1, 2, ..., order`.
  - That is, there is a "moving window" of `order` points that control successive spans.
  - When moving from one cluster of `order` control points to the next, the first (left) point of the first cluster is dropped and a new one is added at the right.
- The sharing of control points provide the critical properties for the curve:
  - No matter how many control points there are (think dozens to hundreds), each individual span is controlled by only `order` points.
  - This "local control" prevents changes "far away" in the control points from causing unexpected global changes in the curve.
  - The sharing of `order-1` points works into the formulas to guarantee smoothness of the curve.
  - Specifically, for a bspline of given `order`:
    - If the knots are strictly increasing (no duplicates) the curve has `order-2` (i.e., `degree-1`) continuous derivatives.
    - Introducing repeated knots reduces the continuity (at the joints between spans). In particular, with `order-1` repeated knots, there is a cusp (abrupt slope change) at that knot.
    - Example: A BSpline curve with degree 2 and 5 poles has 1 cusp if knots = [0, 0, 0.5, 0.5, 1, 1];
    - Example: A BSpline curve with degree 2 and 6 poles has 2 cusps if knots = [0, 0, 0.5, 0.5, 0.5, 1, 1];
    - Example: A BSpline curve with degree 3 and 6 poles has 1 cusp if knots = [0, 0, 0.5, 0.5, 0.5, 1, 1];

- Bspline equations hypothetically allow any integer `order`.
- For practical use the common orders are quite low - 2,3,4, with occasional 5 through 8
  - `order = 2` - the Bspline is a collection of straight lines that connect control points.
  - `order = 3` - the Bspline is a collection of quadratic curves. Quadratic curves with weights can exactly trace circular and elliptic arcs.
  - `order = 4` - the Bspline is a collection of cubic spans. These can have inflections within a span.
  - many graphics systems focus on cubic bsplines (`order = 4, degree = 3`).  These are a good balance of curve flexibility and computational cost.
- Conversationally, if one is thinking of quadratic or cubic curves, it is common to refer to the `degree`, which is one less than the order.
  - The `degree` is the highest power appearing in the polynomial representation of the BSpline.
  - A conventional polynomial form would have coefficients of terms with power 1, 2, through `degree`.
  - That polynomial would also include a constant term that does not multiply a power of `t`.
  - Hence there is _one more coefficient_ than the degree.
  - Textbook algebra discussions prefer reference to the highest power (`degree`) because that is short indicator of complexity.
  - Bspline discussion prefers reference to `order` rather than `degree` because all of the internal matrix manipulations must account for that many coefficients.

## Knots

- The knots are an array of increasing numbers (each element is greater than or equal to the one before it).
- For `0 <= i < numPoles-degree`, the portion of the spline curve `S(t)` restricted to parameter values t in the i_th knot interval `knots[i+degree-1] <= t <= knots[i+degree]` is the i_th polynomial span of the spline, whose shape depends only on the `2*degree` knots at indices `{i, ..., i+2*degree-1}` and the order control points at indices `{i, ..., i+degree}`.
- Within the knots sequence, the values must never go down.

### Clamping

- If knot values are strictly increasing all the way to the end (e.g, [1,2,3,4,5]), the curve does _not_ pass through the first and last control points.
- Having the right number of identical knot values "at the ends" makes the curve (a) pass through the end control points and (b) have tangent direction towards the immediate neighbor.
- Specifically, for a curve of given `degree`, exactly that number of repeated knots creates the usual "clamped" effects.
  - For instance, for a cubic curve, the knots `[0,0,0, 0.25,0.5,0.75, 1,1,1]` will
    - Pass through both end points, with tangent towards the immediate neighbor.
    - Have interior knot "break" at 0.25, 0.5 and 0.75.
    - "Break" means where the polynomial (Bezier) pieces join. These joins happen at parameter values equal to the interior knots.

#### OverClamping

- An important point for exchanging knots with legacy graphics systems (including Microstation and Parasolid) is that there is a long-established (an unnecessary) practice of having _one extra (unused) knot at each end_.
- That is, the _overclamped_ cubic knot sequence with breaks at 0.25, 0.5, and 0.75 would be `[0, 0,0,0, 0.25,0.5,0.75, 1,1,1, 1]`.
- The extra knots at the beginning and end are always multiplied by zero factors making them have no effect.
- In the overClamping convention,

              order + number of control points = number of knots


In `iTwin.js`

- The spline classes (`BsplineCurve3d`, `BSplineCurve3dH` and surface partners) _internally_ do _not_ over-clamp.
- The API for constructing splines accepts both styles of input. The order, knot count, and control point counts distinguish which style is being used.
  - If `numberOfControlPoints === numberOfKnots + order`, the curve is overclamped, so the first and last knot values are not saved in the bspline curve object.
  - If `numberOfControlPoints + 2 === numberOfKnots + order`, the knots are all used.
- The curve objects have method `curve.copyKnots(includeExtraEndKnot: boolean)` to extract knots. The caller can indicate if they prefer overclamped knots by passing `true` for the `includeExtraEndKnot` parameter.
- When knots are written in `iModelJson` objects, they are written with overclamped.

## Summary

The required data for a bspline curve is:

| name | type | remarks |
|-----|-----|------|
| control points | Array of `n` points | |
| order | Number | The most common orders are 2 through 4;  higher order gives smoother curves, but with performance cost. Order higher than 10 is discouraged. |
|  | | 2 (line string, degree 1)
|  | | 3 (quadratic curve, degree 2)
|  | | 4 (cubic curve, degree 3) |
| knots    | Array of `n + order - 2` numbers | See knot section |

## Example: Order 2 (linear) bspline curve

- An order 2 bspline curve has degree 1, i.e., is straight lines.
- The circles in the figure for order 2 bspline are both control points and span breaks.
  - This is the only order for which the span breaks occur at the control points.
- The direction (first derivative) changes at control point.
- Hence there are sharp corners exactly at the control points.

![>](./figs/BCurves/order2.png)

## Example: Order 3 (quadratic) bspline curve

- An order 3 bspline curve has degree 2, i.e., is piecewise quadratic.
- The curve does _not_ pass through the control points (dark).
- There are 4 interior knots and therefore, 4 span breaks (circles).
- Span breaks (circles) are exactly at the midpoints of interior edges.
- For a parametric curve, derivatives are vectors, so to be continuous, they have to have both direction and magnitude continuity.
- Direction (first derivative) is continuous at each span change (circles).
- The concavity (second derivative) changes abruptly at each span change (circles).
  - This concavity change is not always visually obvious.
  - These curves are not as smooth as your eye thinks.
- There are no concavity changes within any single span.
- Clamping (2 identical knots at start, 2 identical knots at end) makes the curve pass through the end control points and point at neighbors.

![>](./figs/BCurves/order3.png)

## Example: Order 4 (cubic) bspline curve

- An order 4 bspline curve has degree 3, i.e., is piecewise cubic.
- The curve does _not_ pass through the control points (dark).
- The curve does _not_ pass through particular points of the polygon edges.
- Span changes (circles) are generally "off the polygon".
- Direction and concavity are both continuous at span changes.
- There can be one concavity change within a span.
- Clamping (3 identical knots at start, 3 identical knots at end) makes the curve pass through the end control points and point at neighbors.

![>](./figs/BCurves/order4.png)

## Example: Order 5 (quartic) bspline curve

- An order 5 bspline curve has degree 4, i.e., is piecewise quartic.
- The curve does _not_ pass through the control points (dark).
- The curve does _not_ pass through particular points of the polygon edges.
- Span changes (circles) are generally "off the polygon".
- Direction, concavity, and third derivative are all continuous at span changes.
- There can be two concavity change within a span.
- Clamping (4 identical knots at start, 4 identical knots at end) makes the curve pass the end control points and point at neighbors.

![>](./figs/BCurves/order5.png)

## References

There are innumerable books and web pages explaining splines. There is a high level of consistency of the concepts -- control points, basis functions, knots, and order. But be very careful about subtle details of indexing. Correct presentations may superficially appear to differ depending on whether the writer has considers `n` indices to run:

- C-style, `0 <= i < n` (with index `n` _not_ part of the sequence)
- Fortran style , `1 <= i <= n`
- (rare) `0 <= i <= n`

Some typical descriptions are:

- <https://en.wikipedia.org/wiki/B-spline>
- <http://web.mit.edu/hyperbook/Patrikalakis-Maekawa-Cho/node17.html>
- <https://www.cs.unc.edu/~dm/UNC/COMP258/LECTURES/B-spline.pdf>

Be especially careful about the number of knot counts, which can differ by 2 as described in the "over-clamping" section.
