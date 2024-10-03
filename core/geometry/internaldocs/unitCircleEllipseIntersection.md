# Intersection of Unit Circle and General Ellipse

We want to find intersections of the homogeneous unit circle $x^2 + y^2 = w^2$ and the general ellipse
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
\end{bmatrix}
$$

By substituting the ellipse equation into the unit circle equation, we get

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

These formulas are used in `TrigPolynomial.solveUnitCircleHomogeneousEllipseIntersection`.

Equation $(1)$ is what we want to solve to get the ellipse angles $\theta$ of the intersections. To take advantage of polynomial root finders tailored to other bases, we make a change of basis from the trigonometric basis $(1, \cos\theta, \sin\theta, \cos\theta\sin\theta, ...)$ to another polynomial basis as follows.

First, note that as $\theta$ traverses from 0 to $\pi$, $\begin{bmatrix}\cos\theta \\ \sin\theta \end{bmatrix}$
traverses the top half of the unit circle. There is a rational homogeneous parameterization for the same path as $t$ goes from $0$ to $1$:

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
$$

The first matrix of scalars encapsulates the Bezier coefficients of the $C$, $S$, and $W$ polynomials in the degree-2 Bernstein-Bezier polynomial basis; the second matrix of scalars, the coefficients in the standard power basis. For more info see:
- https://en.wikipedia.org/wiki/Bernstein_polynomial
- **Curves and Surfaces for CAGD: A Practical Guide**, Gerald Farin, 4th Edition, Section 13.8 (Control Vectors)

The transformation of equation $(1)$ from trigonometric basis to power polynomial basis is performed by the substitution:
$$\begin{equation}\cos\theta = \frac{C(t)}{W(t)} =: x(t),\space\space\space \sin\theta = \frac{S(t)}{W(t)} =: y(t)\end{equation}$$

The method `TrigPolynomial.solveUnitCircleImplicitQuadricIntersection` takes the coefficients of the trigonometric polynomial in $(1)$, and internally applies the transformation $(2)$ to compute its power basis coefficients. The transformed polynomial $P(t)$ has degree at most 4. We currently prefer the power basis because we have polynomial root finders for degrees 2, 3, and 4 implemented by classical formulae. In the future we may use a Bezier polynomial solver that handles any degree, and has the advantage of superior numerical stability of the Bernstein-Bezier basis.

Note that if both arcs are circular, then $a_{cc} = a_{cs} = a_{ss} = 0$, and the quartic reduces to a quadratic.

Once a solution to $P(t) = 0$ is found, the inverse of the substitution $(2)$ yields an ellipse angle $\theta$ of the intersection of the ellipse and the unit circle:

$$\theta = \arctan(\frac{S(t)}{C(t)}).$$
