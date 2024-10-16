# Intersection of Unit Circle and General Ellipse

We want to find intersections of the homogeneous unit circle $x^2 + y^2 = w^2$ and the general homogeneous ellipse $c + u \cos\theta + v\sin\theta$ given by
$$
\begin{bmatrix}
x(\theta) \\
y(\theta) \\
w(\theta)
\end{bmatrix} =
\begin{bmatrix}
u_x & v_x & c_x \\
u_y & v_y & c_y \\
u_w & v_w & c_w
\end{bmatrix}
\begin{bmatrix}
\cos\theta \\
\sin\theta \\
1
\end{bmatrix}.
$$

By substituting the ellipse equation into the circle equation, we get

$$\begin{equation}a_{cc} \cos\theta \cos\theta + a_{cs} \cos\theta \sin\theta + a_{ss} \sin\theta \sin\theta + a_c \cos\theta + a_s \sin\theta + a = 0\end{equation}$$

where

$$\begin{align}
\nonumber{}a_{cc} &= u_x u_x + u_y u_y - u_w u_w\\
\nonumber{}a_{cs} &= 2 (u_x v_x + u_y v_y - u_w v_w)\\
\nonumber{}a_{ss} &= v_x v_x + v_y v_y - v_w v_w\\
\nonumber{}a_c &= 2 (u_x c_x + u_y c_y - u_w c_w)\\
\nonumber{}a_s &= 2 (v_x c_x + v_y c_y - v_w c_w)\\
\nonumber{}a &= c_x c_x + c_y c_y - c_w c_w
\end{align}$$

The above formulae are used in `TrigPolynomial.solveUnitCircleHomogeneousEllipseIntersection`.

Equation $(1)$ is what we want to solve to find the ellipse angles $\theta$ of the intersections. To take advantage of polynomial root finders tailored to other bases, we make a change of basis from the trigonometric basis $(1, \cos\theta, \sin\theta, \cos\theta\sin\theta, ...)$ to another polynomial basis as follows.

Consider this substitution defined by the rational homogeneous parameterization of the unit circle $^1$:
$$\begin{equation}\cos\theta = \frac{C(t)}{W(t)} =: x(t),\space\space\space \sin\theta = \frac{S(t)}{W(t)} =: y(t)\end{equation}$$

where

$$
\begin{bmatrix}
C(t) \\
S(t)  \\
W(t)
\end{bmatrix} =
\begin{bmatrix}
1 & 0 & -1 \\
0 & 1 & 0 \\
1 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
(1-t)^2 \\
2t(1-t)  \\
t^2
\end{bmatrix} =
\begin{bmatrix}
1 & -2 & 0 \\
0 & 2 & -2 \\
1 & -2 & 2
\end{bmatrix}
\begin{bmatrix}
1 \\
t \\
t^2
\end{bmatrix}
.$$

By substituting $(2)$ into $(1)$, the problem of solving the trigonometric equation for angles $\theta$ is transformed into the problem of solving a nominally quartic polynomial equation for parameters $t\in\R$.

In `TrigPolynomial.solveUnitCircleImplicitQuadricIntersection` we perform this transformation, then compute the roots of the transformed polynomial. For each root $t$ found, the inverse of the substitution $(2)$ yields an angle $\theta$ at which the ellipse intersects the unit circle:

$$\theta = \arctan\left(\frac{S(t)}{C(t)}\right).$$

**Remark:** We defined the substitution $(2)$ in terms of two polynomial bases. The first matrix of scalars encapsulates the Bezier coefficients in the degree-2 Bernstein-Bezier polynomial basis $^2$; the second matrix of scalars, the coefficients in the standard power basis. We currently employ the power basis version of $(2)$ because we have root finders for degrees <= 4 based on classical formulae. In the future we may use a Bezier polynomial solver that handles any degree, and has the advantage of superior numerical stability of the Bernstein-Bezier basis.

**Remark:** As $t$ increases between $-\infty$ and $\infty$, the point $(x(t),y(t))$ traverses the entire unit circle counterclockwise save for one point: $(0,-1)$, which corresponds to angle $\theta=-\pi/2$. A solution to $(1)$ that lies at this "point at infinity" in the rational parameterization cannot be found by a polynomial root finder, so we have to test for this root separately. Specifically, referring to equation $(1)$ as transformed by $(2)$ into the power basis:

$$c_0 + c_1 t + c_2 t^2 + c_3 t^3 + c_4 t^4 = 0,$$

all we need to do is check the size of the leading coefficient, since

$$\begin{align}
\notag{}c_4 = 0 &\Leftrightarrow 4a_{ss} - 4a_s + 4a = 0 \\
\notag{}&\Leftrightarrow (c_x - v_x)^2 + (c_y - v_y)^2 = (c_w - v_w)^2 \\
\notag{}&\Leftrightarrow c-v \rm{\ is\ on\ the\ homogeneous \ unit\ circle} \\
\notag{}&\Leftrightarrow \theta=-\frac{\pi}{2} \rm{\ is\ a\ solution\ of\ }(1).
\end{align}$$

References:
1. **Curves and Surfaces for CAGD: A Practical Guide**, Gerald Farin, 4th Edition, Section 13.8 (Control Vectors)
2. https://en.wikipedia.org/wiki/Bernstein_polynomial