---
publish: false
---
# NextVersion

Table of contents:

- [Geometry](#geometry)
  - [Clip any curve](#clip-any-curve)
  - [Polyface adjacent facet queries](#polyface-adjacent-facet-queries)

## Geometry

### Clip any curve

The new [ClipUtils.clipAnyCurve] clips any `CurvePrimitive`, `Path`, or `BagOfCurves` and any region including any `Loop`, `ParityRegion`, or `UnionRegion`. One just needs to pass `AnyCurve` and a `Clipper` and the functions collect portions of any curve that are within the clipper into an array of any curves and returns the array.

### Polyface adjacent facet queries

- Conventional polyface data defines each facet by a sequence of indices of point coordinates "around the facet"
- These indices do not indicate what facet is adjacent "across each edge of the facet"
- new method [IndexedPolyface.buildEdgeMateIndices] constructs indices for the cross-edge relationship.
- Following that construction, the following queries support navigation around each facet, around each vertex, and across each edge:
  - polyface.readIndexToEdgeMate = (possibly undefined) readIndex of the edge mate.
  - polyface.readIndexToSuccessorAroundFacet = readIndex of the next vertex around the facet.
  - polyface.readIndexToPredecessorAroundFacet = readIndex of the previous vertex around the facet
  - polyface.readIndexToSuccessorAroundVertex = (possibly undefined) readIndex of the next vertex around the facet.
  - polyface.readIndexToPredecessorAroundVertex = (possibly undefined) readIndex of the previous vertex around the facet
