# Finding Roots of a Quartic Polynomial

In `AnalyticRoots.appendQuarticRoots` we compute the solutions of the general quartic equation:
$$a_4x^4 + a_3x^3 + a_2x^2 + a_1x + a_0 = 0.\tag{1}$$

Without loss of generality, assume $a_4 = 1$. We further simplify by performing the substitution $x = y - a_3/4$ to obtain the depressed quartic:
$$P(x) = x^4 + px^2 + qx + r.$$

Note that the solutions of $(1)$ are obtained by subtracting $a_3/4$ from each root of $P$.

Most classical solutions to $(1)$ derive a so-called _resolvent_ cubic polynomial $R$ from the depressed quartic, and use one of the roots of $R$ to construct a pair of quadratic equations whose roots are the roots of $P$. We will show this, using a resolvent cubic of this form:
$$R(y) = y^3 - \frac{1}{2}py^2 - ry + \frac{1}{2}rp - \frac{1}{8}q^2.$$

Let $x$ be a root of $P$. Then, introducing a quantity $y$ to complete the square, we have the following equivalences:

$$\begin{align}
\notag{}P(x) = 0 &\Leftrightarrow x^4 = -px^2 - qx - r \\
\notag{}&\Leftrightarrow (x^2 + y)^2 = -px^2 - qx - r + 2yx^2 + y^2 \\
&\Leftrightarrow (x^2 + y)^2  = (2y - p)x^2 - qx + (y^2 - r)\tag{2} \\
&\Leftrightarrow (x^2 + y)^2  = \left(\sqrt{2y - p}x - \frac{q}{2\sqrt{2y - p}}\right)^2\tag{3} \\
&\Leftrightarrow \frac{q^2}{4(2y - p)} = y^2 - r\tag{4} \\
\notag{}&\Leftrightarrow q^2 = 4(y^2 - r)(2y - p) \\
\notag{}&\Leftrightarrow 0 = 8 R(y),
\end{align}$$

where in $(3)$ we have rewritten the right hand side of $(2)$ as a square (since the left hand side of $(2)$ is a square), and in $(4)$ we have equated the constant terms on the right hand sides of $(2)$ and $(3)$. Thus it is seen that the quantity $y$ is actually a root of the resolvent. We can compute the roots of $R$ with `AnalyticRoots.appendCubicRoots`.

Lastly, choose a root $z$ of $R$. We need only one, so `AnalyticRoots.mostDistantFromMean` picks one employing a numerical stability criterion. Then from the above equivalences, and taking the square root of both sides of $(3)$, we have two quadratics in $x$:

$$\begin{align}
\notag{}R(z) = 0 &\Leftrightarrow x^2 + z = \pm\left(\sqrt{2z - p}x - \frac{q}{2\sqrt{2z - p}}\right) \\
&\Leftrightarrow x^2 \pm\sqrt{2z - p}x + z \mp\sqrt{z^2 - r} = 0,\tag{5}
\end{align}$$

where we have used the equality $(4)$ to simplify the constant term. We solve these two quadratics with `AnalyticRoots.appendQuadraticRoots`, yielding 0-4 values of $x$. By the above equivalences, each of these is a root of $P$.

