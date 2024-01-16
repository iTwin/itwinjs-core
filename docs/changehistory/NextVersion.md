---
publish: false
---
# NextVersion

Table of contents:

- [Geometry](#geometry)
  - [Range tree search](#range-tree-search)

## Geometry

### Range tree search

New efficient range tree methods [PolyfaceRangeTreeContext.searchForClosestPoint]($core-geometry) and [PolyfaceRangeTreeContext.searchForClosestApproach]($core-geometry) support searches of a [Polyface]($core-geometry) for the closest facet point to a given space point, and searches of two Polyfaces for the segment spanning their closest approach. New classes [Point3dArrayRangeTreeContext]($core-geometry) and [LineString3dRangeTreeContext]($core-geometry) provide similar functionality for searching [Point3d]($core-geometry) arrays and [LineString3d]($core-geometry) objects, respectively.
