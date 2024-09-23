# Intersection of Unit Circle and General Ellipse

We want to find intersections of the homogeneous unit circle $x^2 + y^2 = w^2$ and the general ellipse
$$
\begin{bmatrix}
x(\theta) \\
y(\theta)  \\
w(\theta)
\end{bmatrix} =
\begin{bmatrix}
u_x & v_x & c_x \\
u_y & v_y & c_y \\
u_w & v_w & c_w
\end{bmatrix}
\begin{bmatrix}
\cos\theta \\
\sin\theta  \\
1
\end{bmatrix}
$$

By substitution ellipse equation into unit circle equation, we get

$a_{cc} \cos\theta \cos\theta + a_{cs} \cos\theta \sin\theta + a_{ss} \sin\theta \sin\theta + a_c \cos\theta + a_s \sin\theta + a = 0 $ **(*)**

where

$a_{cc} = u_x u_x + u_y u_y - u_w u_w\\$
$a_{cs} = 2 (u_x v_x + u_y v_y - u_w v_w)\\$
$a_{ss} = v_x v_x + v_y v_y - v_w v_w\\$
$a_c = 2 (u_x c_x + u_y c_y - u_w c_w)\\$
$a_s = 2 (v_x c_x + v_y c_y - v_w c_w)\\$
$a = c_x c_x + c_y c_y - c_w c_w\\$

Above is used in `TrigPolynomial.solveUnitCircleHomogeneousEllipseIntersection`.

This is the equation we want to solve for $\theta$ to get the angles of intersections. However, trigonometry equations are not easy to solve. Therefor, we look to change the basis of equation from $(1, \cos\theta$, $\sin\theta, ...)$ to $(1,t,t^2,...)$ to make the problem easier.

Note that as $\theta$ traverses from 0 to $\pi$, $\begin{bmatrix}\cos\theta \\ \sin\theta \end{bmatrix}$
traverses the top half of the unit circle. There is a rational formula that traverses the same path:
$\begin{bmatrix}\frac{C(t)}{W(t)} \\ \frac{S(t)}{W(t)}\end{bmatrix}$ as $t$ goes from $0$ to $1$ where $C$, $S$, and $W$ are defined using Bernstein basis:

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
\end{bmatrix}
$$

For more info see
- https://en.wikipedia.org/wiki/Bernstein_polynomial
- **Curves and Surfaces for CAGD: A Practical Guide**, Gerald Farin, 4th Edition, Section 13.8 (Control Vectors)

Now we have

$C(t) = (1-t)^2 - t^2 = 1 - 2t \\$
$S(t) = 2t(1-t) = 2t - 2t^2 \\$
$W(t) = (1-t)^2 + t^2 = 1 - 2t + 2t^2$

so if we choose basis to be $1,t,t^2,...$ we get

$C = [1, -2]\\$
$S = [0, 2, -2]\\$
$W = [1, -2, 2]$


So by the substitution $\cos\theta=\frac{C(t)}{W(t)}$ and $\sin\theta = \frac{S(t)}{W(t)}$ we can re-parametrize equation **(*)** to below equation which is more numerically stable for root-finding:

$a_{xx} \frac{CC}{WW} + a_{xy} \frac{CS}{WW} + a_{yy} \frac{SS}{WW} + a_x \frac{C}{W} + a_y \frac{S}{W} + a = 0$

or

$a_{xx} CC + a_{xy} CS + a_{yy} SS + a_x CW + a_y SW + aWW = 0$

Above equation is at most a degree 4 polynomial in $t$ and easy to solve. In particular, if $a_{xx}$, $a_{xy}$, and $a_{yy}$ are zero (meaning both arcs are circular), this equation reduces to the degree 2:

$a_x CW + a_y SW + aWW = 0$

Above formulas are used in `TrigPolynomial.solveUnitCircleImplicitQuadricIntersection`.

Since $\sin(\theta) =\frac{S(t)}{W(t)} $ and $\cos(\theta) =\frac{C(t)}{W(t)}$, after $t$ is found, it can be converted to $\theta$ using

$$\theta = \arctan(\frac{S(t)}{C(t)})$$
