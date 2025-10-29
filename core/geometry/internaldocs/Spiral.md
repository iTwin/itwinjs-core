# Spirals

## General Math

A spiral is a curve that winds around a point (usually the origin), moving progressively closer or farther away from it.

Mathematically, a spiral can be described in polar coordinates $(r,θ)$ where $r$ is the distance from the origin and $θ$ is the angle (in radians) from the x-axis. Therefore, a spiral can be defined by $r=f(θ)$ where $f(θ)$ describes how the radius grows as the angle increases.

**Example:**

*Archimedean Spiral:*
$$r=a+bθ$$
Parametric (Cartesian) form:
$$x(θ)=(a+bθ)cosθ \\ y(θ)=(a+bθ)sinθ​$$

*Logarithmic Spiral:*
$$r=ae^{bθ}$$
Parametric (Cartesian) form:
$$x(θ)=ae^{bθ}cosθ \\ y(θ)=ae^{bθ}sinθ​$$

-----------

Another way to represent a spiral is via its curvature. In general, for a curve parameterized by curve length $\bar{s}$ we have:

$$\frac{dθ}{d\bar{s}} = κ(\bar{s})$$

where where $κ(\bar{s})$ is curvature. If $p$ is the position vector we have

$$p(s) = (x'(\bar{s}),y'(\bar{s})) = (cosθ(\bar{s}), sinθ(\bar{s}))$$

so integrating gives positions:

$$x(\bar{s})= \int_{0}^{\bar{s}} cosθ(u)du \\ y(\bar{s})= \int_{0}^{\bar{s}} sinθ(u)du $$

For a spiral defined by curvature varying smoothly with length, we have fraction $s = \frac{\bar{s}}{L}$ or $\bar{s} = Ls$ where $L$ is the total spiral length. This gives:

$$θ(s)= \int_{0}^{Ls} κ(u)du$$

Replacing this into previous formula and switching variable to fraction form gives:

$$\boxed{
\begin{aligned}
  x(s)= L \int_{0}^{s} \Bigl(\int_{0}^{Lu} 𝜅(v)dv\Bigl) du \\ y(s)= L \int_{0}^{s} \Bigl(\int_{0}^{Lu} 𝜅(v)dv\Bigl) du
\end{aligned}
}$$

**Example:**

*Euler Spiral (Clothoid)*

Curvature $𝜅$ increases linearly with arc length $s$:
$$𝜅(s) = cs \Rightarrow θ(s) = \frac{cs^2}{2} $$
where $c$ is a constant.

Parametric (Cartesian) form:
$$x(s)= \int_{0}^{s} cos\Bigl(\frac{cu^2}{2}\Bigl)du \\ y(s)= \int_{0}^{s} sin\Bigl(\frac{cu^2}{2}\Bigl)du $$

![>](./figs/Spiral/spirals.png)

## Code

**TransitionSpiral3d**

Parent class for all iTwin spirals is `TransitionSpiral3d` which is extended by `IntegratedSpiral3d` and `DirectSpiral3d`.

`TransitionSpiral3d` class has an member called `TransitionConditionalProperties` which encapsulates 5 elements: `radius0`, `radius1`, `bearing0`, `bearing1`, and `curveLength`.

We already know:
$$θ(s)= \int_{0}^{Ls} 𝜅(u)du$$
This can be rewritten as
$$θ_1 - θ_0 = L \bar{𝜅} = L \frac{𝜅_0 + 𝜅_1}{2}$$
where $\bar{𝜅}$ is curvature average, $θ_0$ is `bearing0`, $θ_1$ is `bearing1`, $L$ is `curveLength`, $𝜅_0$ is `1/radius0`, and $𝜅_1$ is `1/radius1`.

**IntegratedSpiral3d**

iTwin has 5 integrated spirals: `clothoid`, `bloss`, `biquadratic`, `cosine`, and `sine`. All 5 are defined by their curvature function $𝜅(s)$ in `NormalizedTransition` class.

**Note:** `NormalizedTransition` class has normalized formulas meaning $𝜅(0) = 0$ and $𝜅(1) = 1$ while in general we have  $𝜅(0) = 𝜅_0$ and $𝜅(1) = 𝜅_1$. We will show how to calculate general values using normalized values.

The spiral $x$ and $y$ coordinates is calculated by

$$\boxed{
\begin{aligned}
  x(s)= L \int_{0}^{s} \Bigl(\int_{0}^{Lu} 𝜅(v)dv\Bigl) du \\ y(s)= L \int_{0}^{s} \Bigl(\int_{0}^{Lu} 𝜅(v)dv\Bigl) du
\end{aligned}
}$$

These coordinates are stored in `_globalStrokes` and `_activeStrokes` which are populated in `IntegratedSpiral3d.refreshComputedProperties` via call to `IntegratedSpiral3d.fullSpiralIncrementalIntegral`. This function calculates the outer integral numerically using Gaussian quadrature formula.


The inner integral, which is in fact the angle $θ$, is calculated analytically by `IntegratedSpiral3d.globalFractionToBearingRadians`.

Suppose this is the curvature graph:
![>](./figs/Spiral/curvature_graph.png)

`IntegratedSpiral3d.globalFractionToBearingRadians` calculates the angle $θ$ by calculating the area under the graphs.

The area is the pink rectangle area $s*L*K0$ plus green area which is the normalized integral and has to be scaled by curve length for $x$ and curvature delta for $y$. Start angle should also be added to the calculated area to correctly determine the angle $θ$.

These translate to below code:


```ts
public globalFractionToBearingRadians(fraction: number): number {
  const areaFraction = this._evaluator.fractionToArea(fraction);
  const arcLength = this._arcLength01;
  return this.bearing01.startRadians // start angle
    + fraction * arcLength * this._curvature01.x0 // pink area
    + areaFraction * arcLength * this._curvature01.signedDelta(); // green area
}
```

**DirectSpiral3d**

Direct spirals do not use integration to calculate $x$ and $y$ coordinates. Instead they use direct formulas to find coordinates.

The 4 spirals `JapaneseCubic`, `Arema`, `ChineseCubic`, and `WesternAustralian` have a formula for $θ$ (which is $θ(s) = c*s^2$).

To find the $x$ and $y$ coordinates for each one of those 4 spirals:

- We find Taylor series of $cos(θ)$ and $sin(θ)$
- We pick a couple of $x$ and $y$ terms in the series
- We replace $θ(s)$ with $c*s^2$
- We integrate

All these steps are done in `ClothoidSeriesRLEvaluator`.

The 5 spirals `AustralianRailCorp `, `Czech`, `Italian`, `MXCubicAlongArc`, and `Polish` are indeed NOT spirals`. Those are just cubic curves defined by
$$x(s)= sL \\ y(s) = cs^3$$
that briefly take off from the x axis "like a spiral".

All of these 5 spirals extend `CubicEvaluator` class.
