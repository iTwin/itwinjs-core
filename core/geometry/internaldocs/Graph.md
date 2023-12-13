# `Visualization of Exterior and Boundary HalfEdge`

Exterior HalfEdges (nodes) are shown by green and Boundary HalfEdges (nodes) are shown by blue:

<img src="./figs/Graph/exteriorBoundaryHalfEdges.png" width="400">

# `Visualization of Some of HalfEdge Functions`

Here is visualization of some the HalfEdge functions (`createHalfEdgePair`, `splitEdge`, and `splitEdgeCreateSliverFace`). Note that edges of the graph are indicated by black lines and vertices of the graph are indicated by black dots. HalfEdges (nodes) are indicated by non-black dots. The arrow emanating from a node points to its faceSuccessor node.

![>](./figs/Graph/halfEdgeAPI.png)

# `Signed Area of a Face`

Here is the illustration of the `HalfEdge.signedFaceArea` algorithm:

![>](./figs/Graph/signedFaceArea.png)


# `Transverse Intersection Fractions`

Here is the math details of `HalfEdge.transverseIntersectionFractions`

<img src="./figs/Graph/transverseIntersectionFractions.png" width="500">

Let $A0 = (x_{a_0},y_{a_0}), A1 = (x_{a_1},y_{a_1}), B0 = (x_{b_0},y_{b_0}),$ and $B1 = (x_{b_1},y_{b_1})$.

The parametric equations of the lines are:

$(1-t_a)(x_{a_0},y_{a_0}) + t_a (x_{a_1},y_{a_1})$

$(1-t_b)(x_{b_0},y_{b_0}) + t_b (x_{b_1},y_{b_1})$

These 2 equations are equal at the intersection so:

$((1-t_a)x_{a_0} + t_a x_{a_1},(1-t_a)y_{a_0} + t_a y_{a_1}) = ((1-t_b)x_{b_0} + t_b x_{b_1},(1-t_b)y_{b_0} + t_b y_{b_1})$

which leads to the final equations:

$ (x_{a_1} - x_{a_0}) t_a + (x_{b_0} - x_{b_1}) t_b = x_{b_0} - x_{a_0} $

$ (y_{a_1} - y_{a_0}) t_a + (y_{b_0} - y_{b_1}) t_b = y_{b_0} - y_{a_0} $

# `Pinch`

Pinch is visualized in the following 2 sections.

# `Create EdgeXYZ HalfEdge`

Here is the visualization of the `HalfEdgeGraph.createEdgeXYZHalfEdge`:

![>](./figs/Graph/createEdgeXYZHalfEdge.png)

# `Create HalfEdge HalfEdge`

Here is the visualization of the `HalfEdgeGraph.createEdgeHalfEdgeHalfEdge`:

![>](./figs/Graph/createEdgeHalfEdgeHalfEdge.png)