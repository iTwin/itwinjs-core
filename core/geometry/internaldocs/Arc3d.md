# Create Circular Arc using Start, TangentAtStart, and End

Below we explain the algorithm used in `Arc3d.createCircularStartTangentEnd` to create a circular arc using start point, tangent at start, and end point.

We first set up a frame of three perpendicular unit vectors using `Matrix3d.createRigidFromColumns`:
* `frameColX` lies along `tangentAtStart`,
* the circle normal lies along the cross product of `tangentAtStart` and the vector `startToEnd`, and
* `frameColY` lies along the cross product of the normal and `tangentAtStart`.

We seek a formula for the radius of the circle. From the radius, we can find the circle center by moving a distance of radius from `start` along `frameColY`. From the center and the two input points, we can compute the arc sweep. Then we are done.

The key to finding the radius is the inscribed right triangle pictured below, with one vertex at `start`, with hypotenuse along a diameter, and with leg along `startToEnd`. We know this is a right triangle from the inscribed angle theorem of classical geometry.

Suppose `v = startToEnd`, `w = frameColY`, `r` is the radius we seek, and $\theta$ is the right triangle's angle at `start`. Then with

$$v\cdot w = ||v|| ||w|| \cos\theta = ||v|| \frac{||v||}{2r} = \frac{||v||^2}{2r},$$

we have:

$$\frac{v\cdot v}{2v\cdot w} = \frac{||v||^2}{2\frac{||v||^2}{2r}} = r.$$

![>](./figs/Arc3d/createCircularStartTangentEnd.png)