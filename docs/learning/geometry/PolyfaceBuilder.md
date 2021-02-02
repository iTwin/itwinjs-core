
# PolyfaceBuilder Remarks

A PolyfaceBuilder constructs coordinate and index data for an IndexedPolyface.

A caller creates a builder and then calls various methods to add to the evolving polyface.

There are 3 levels of detail for builder methods:

| Level | Input type | Example | Actions |
|---------------|-------------------|--------------|--------------|
| High | GeometryQuery object  | addGeometryQuery addBox addCone addSphere addTorusPipe add LinearSweep addRotationalSweep addRuledSweep addPolygon addIndexedPolyface | call mid- or low- level methods for major parts (sides, caps) of the geometry query. |
| mid | Single-parameter space portions  | addUVGrid addBetweenLineStrings addBetweenStroked addBetweenTransformedLineStrings addGraph | enumerate quad and triangles in the grid/circle/polygon |
| single or structured facet | single facet | addIndexedQuadNormalIndexes addIndexedQuadParamIndexes addIndexedQuadPointIndexes addIndexedTriangleNormalIndexes addIndexedTriangleParamIndexes addIndexedTrianglePointIndexes addTriangleFan addTrianglesInUncheckedFan addTriangleFanFromIndex0 | multiple inserts to arrays |
| array entry | single datum for array | findOrAddPoint findorAddPointInLineString findOrAddPointXYZ | |
