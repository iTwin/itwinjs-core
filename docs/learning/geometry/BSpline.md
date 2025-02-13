# B-spline Curves

A [BSplineCurve3d]($core-geometry) is a curve that (loosely) follows a sequence of control points (poles).

Internally, the curve is a sequence of polynomial curves that join together smoothly. Call each of those separate pieces a _span_.

A B-spline curve of order `k+1` (degree `k`) is defined by:
```math
S(t) = \sum_{i=0}^{n} N_{i,k}(t) P_i
```
where $P_0$, $P_1$, ..., $P_n$ are the control points, and the functions $N_{i,k}(t)$ are called B-splines, which form a _basis_ for degree `k` piecewise polynomial functions (thus the "B"). B-splines satisfy the de Boor-Cox-Mansfield recursion formula, which shows that each B-spline is a convex combination of two B-splines of one less degree:

```math
N_{i,0}(x) =
\begin{cases}
1 & \text{if } t_i \leq t < t_{i+1} \\
0 & \text{otherwise}
\end{cases}
```
```math
N_{i,j}(t) = \frac{t - t_i}{t_{i+j} - t_i} N_{i,j-1}(t) + \frac{t_{i+j+1} - t}{t_{i+j+1} - t_{i+1}} N_{i+1,j-1}(t)
```
The sequence $\{t_i\}$ is a non-decreasing vector of $k+n$ numbers called knots, which determine where the polynomial spans of the curve join in parameter space, and with what degree of continuity.

Please note that we always have:

              order + number of control points = number of knots + 2

## Control Points

The control points of a B-spline curve, and the line string (aka "control polygon") they form, have remarkable properties for computation:

- The curve never leaves the overall xyz range of the control points.
- This bounding property applies from any viewpoint, not just in the coordinate system where they are given.
- Even tighter, the curve is contained within the convex hull of the control points.
- No plane can intersect the curve more often than it intersects the control polygon.
  - In other words, the polygon may overestimate the number of intersections (i.e., suggest false intersections), but it never underestimates.
- Inspection of the control polygon gives similar "never underestimate" statements about other properties such as:
  - the number of inflections (inflection is a point on the curve where the curvature changes sign).
  - the number of minima and maxima of the curve and its derivatives.
- The use of "weights" on the control points allows a B-spline curve to exactly trace circular and elliptic arcs without resorting to trigonometric functions. The relevant class is [BSplineCurve3dH]($core-geometry).

## Order

The `order = degree+1` of the B-spline curve is the number of control points that are "in effect" over an individual span.

- The first span is controlled by the first `order` control points, i.e., those indexed `0, 1, ..., order-1`.
- The next span is controlled by control points indexed `1, 2, ..., order`.
  - That is, there is a "moving window" of `order` points that control successive spans.
  - When moving from one cluster of `order` control points to the next, the first (left) point of the first cluster is dropped and a new one is added at the right.
- The sharing of control points provide the critical properties for the curve:
  - No matter how many control points there are (think dozens to hundreds), each individual span is controlled by only `order` points.
  - This "local control" prevents changes "far away" in the control points from causing unexpected global changes in the curve.
  - The sharing of `order-1` points works into the formulas to guarantee smoothness of the curve.
  - Specifically, for a B-spline curve of given `order`:
    - If the knots are strictly increasing (i.e., "simple" knots, no duplicates) the curve has `order-2` continuous derivatives everywhere.
    - Introducing repeated knots reduces the continuity of the B-spline curve at the knot. In particular, at a knot with multiplicity `order-1`, there is a cusp (abrupt slope change) at that knot.

- B-spline curves technically take any positive integer `order`, but in practical use the common orders are quite low: 2,3,4, with occasional 5 through 8.
  - `order = 2`: the B-spline curve is a collection of line segments that connect the control points.
  - `order = 3`: the B-spline curve is a collection of parabolas. Quadratic B-spline curves with weights can exactly trace circular and elliptic arcs.
  - `order = 4`: the B-spline curve is a collection of cubic spans. These can have inflections within a span.
  - Many graphics systems focus on cubic B-splines (`order = 4, degree = 3`).  These are a good balance of curve flexibility and computational cost.
- It is often more convenient to refer to the `degree = order - 1` of the B-spline curve.
  - The `degree` is the highest power appearing in the polynomial spans of the B-spline curve.
  - The conventional "power basis" form of a polynomial in `x` has coefficients multiplying powers of x, with exponents 1, 2, through `degree`. This polynomial also includes a constant term, hence there is _one more coefficient_ than the degree.
  - Textbook algebra discussions tend to refer to the highest power (`degree`) because it is a simple indicator of polynomial complexity.
  - B-spline theory prefers `order` to `degree` because all of the internal matrix manipulations must account for `order` coefficients.

## Knots

- The knot vector is an array of non-decreasing numbers, i.e., each number is greater than or equal to the one before it.
- For `0 <= i < numPoles-degree`, the portion of the B-spline curve `S(t)` restricted to parameter values t in the i_th knot interval `knots[i+degree-1] <= t <= knots[i+degree]` is the i_th polynomial span, whose shape depends only on the `2*degree` knots at indices `{i, ..., i+2*degree-1}` and the `order` control points at indices `{i, ..., i+degree}`.
- In particular, the parametric domain of the B-spline `S(t)` is `knots[degree-1] <= t <= knots[numPoles-1]`. In the API, this sub-range of knots is referred to as the "active knot interval".
- The knots are not restricted to any numerical range, but often they are normalized so that the domain of the B-spline curve is `[0,1]`, matching the fractional parameterization common to all `CurvePrimitive`s.
- A knot at which the B-spline curve evaluates to a point shared by two spans is called an "interior knot". The other knots (`degree` knots at the start of the knot vector, and `degree` knots at the end) are called "exterior knots". If the curve has only one span, there are no interior knots.
- If the interior knots are uniformly spaced throughout the B-spline curve's domain, the knot vector is called "uniform".

### Clamping

- If knot values are strictly increasing all the way to the end (e.g, [1,2,3,4,5]), the curve does _not_ pass through the first and last control points.
- Having the right number of identical knot values at the start/end of the knot vector makes the B-spline curve (a) pass through the start/end control point and (b) have tangent parallel to the first/last leg of the control polygon.
- This clamping effect is induced in a degree `k` B-spline curve by a knot with multiplicity `k`.
- Example: with knot vector `[0,0,0, 0.25, 0.5, 0.75, 1,1,1]`, a degree 3 (cubic) B-spline curve `S`:
  - passes through start and end control points
  - has curve start and end tangent aligned to the control polygon
  - has four spans that join at the points evaluated at the interior knots: `S(0.25)`, `S(0.5)`, and `S(0.75)`

#### Overclamping

- An important point for exchanging knots with legacy graphics systems (including MicroStation and Parasolid) is that there is a long-established practice of adding _one extra knot at each end_ of the knot vector. Call this "overclamping".
  - Example: the overclamped form of the cubic knot sequence in the previous example is `[0,0,0,0, 0.25, 0.5, 0.75, 1,1,1,1]`.
- The two knots added by an overclamped knot vector are computationally unnecessary, as where they appear in the B-spline recurrence relation, they are multiplied by basis function evaluations that vanish.

- The B-spline classes [BSplineCurve3d]($core-geometry), [BSplineCurve3dH]($core-geometry), and surface variants internally do _not_ overclamp.
- However, the construction API accepts both knot formats. The order, knot count, and control point count distinguish which format is being supplied:
  - If `numberOfKnots === numberOfControlPoints + order`, the curve is overclamped, so the first and last knot values are not saved in the B-spline curve object.
  - If `numberOfKnots === numberOfControlPoints + order - 2`, the curve is not overclamped, and all knots are used.
- The curve objects have a method to extract knots, e.g., [BSplineCurve3d.copyKnots]($core-geometry), which takes a boolean `includeExtraEndKnot` to control whether or not to return an overclamped knot vector.
- When knots are serialized to JSON and FlatBuffer, they are overclamped.

## Summary

The required data for a B-spline curve is:

| name | type | remarks |
|-----|-----|------|
| control points | Array of `n` points | |
| order | Number | The most common orders are 2 through 4;  higher order gives smoother curves, but with performance cost. Order higher than 10 is discouraged. |
|  | | 2 (line string, degree 1)
|  | | 3 (quadratic curve, degree 2)
|  | | 4 (cubic curve, degree 3) |
| knots    | Array of `n + order - 2` numbers | Must be non-decreasing |

## Example: Order 2 (linear) B-spline curve
- Degree is 1, i.e., the curve is piecewise linear. The curve is equivalent to its control polygon.
- The circles in the figure refer to both control points and points where the spans join.
- The curve has discontinuous first derivative because tangent direction changes at each span join.
- Specifics for this example:
  - Knot vector (clamped, normalized, uniform): `[0, 1/6, 2/6, 3/6, 4/6, 5/6, 1]`.

![>](./figs/BCurves/order2.png)

## Example: Order 3 (quadratic) B-spline curve
- Degree is 2, i.e., the curve is piecewise quadratic.
- The black dots in the figure refer to control points; the circles refer to points where the spans join.
- The curve does _not_ pass through the control points.
- The spans join at the midpoints of interior edges of the control polygon.
- The curve has discontinuous second derivative where the spans join; either the second derivative direction (concavity) changes abruptly, as is seen here, or its magnitude changes abruptly, which is not always visibly obvious.
- There are no concavity changes within any single span.
- Specifics for this example:
  - Knot vector (clamped, normalized, uniform): `[0,0, 0.2, 0.4, 0.6, 0.8, 1,1]`.
  - This curve interpolates the first and last points and tangent directions of its control polygon because its knot vector is clamped.
  - This curve has 4 interior knots and therefore 5 spans.
  - This curve has continuous first derivative (tangent magnitude and direction) where the spans join because its interior knots are simple.

![>](./figs/BCurves/order3.png)

## Example: Order 4 (cubic) B-spline curve
- Degree is 3, i.e., the curve is piecewise cubic.
- The black dots in the figure refer to control points; the circles refer to points where the spans join.
- The curve does _not_ pass through the control points.
- The curve does _not_ pass through particular points of the control polygon.
- The spans join at points off the control polygon.
- There can be at most one concavity change within a span.
- Specifics for this example:
  - Knot vector (clamped, normalized, uniform): `[0,0,0, 0.25, 0.5, 0.75, 1,1,1]`.
  - This curve interpolates the first and last points and tangent directions of its control polygon because its knot vector is clamped.
  - This curve has 3 interior knots and therefore 4 spans.
  - This curve has continuous first and second derivatives (tangent and concavity magnitude and direction) where the spans join because its interior knots are simple.

![>](./figs/BCurves/order4.png)

## Example: Order 5 (quartic) B-spline curve
- Degree is 4, i.e., the curve is piecewise quartic.
- The black dots in the figure refer to control points; the circles refer to points where the spans join.
- The curve does _not_ pass through the control points.
- The curve does _not_ pass through particular points of the control polygon.
- The spans join at points off the control polygon.
- There can be at most two concavity changes within a span.
- Specifics for this example:
  - Knot vector (clamped, normalized, uniform): `[0,0,0,0, 1/3, 2/3, 1,1,1,1]`.
  - This curve interpolates the first and last points and tangent directions of its control polygon because its knot vector is clamped.
  - This curve has 2 interior knots and therefore 3 spans.
  - This curve has continuous first, second, and third derivatives where the spans join because its interior knots are simple.

![>](./figs/BCurves/order5.png)

## References

There are innumerable books and web pages explaining B-spline curves. There is a high level of consistency of the concepts: control points, basis functions, knots, and order. But be very careful about subtle details of indexing. Correct presentations may superficially appear to differ depending on whether the writer considers `n` indices to run:
- C-style, `0 <= i < n`
- Fortran style , `1 <= i <= n`
- (rare) `0 <= i <= n`
Be especially careful about the number of knot counts, which can differ by 2 as described in the section "Overclamping" above.
Some typical descriptions are:
- <https://en.wikipedia.org/wiki/B-spline>
- <http://web.mit.edu/hyperbook/Patrikalakis-Maekawa-Cho/node17.html>
- <https://www.cs.unc.edu/~dm/UNC/COMP258/LECTURES/B-spline.pdf>
