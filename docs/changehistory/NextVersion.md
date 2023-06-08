---
publish: false
---
# NextVersion

## Geometry

### Sweeping a section to a sequence of planes

A new method [CurveFactory.createMiteredSweepSections]($core-geometry) moves a section "along" a polyline path; at each vertex the section projects to the plane with normal that is the average of inbound and outbound edges.

Here are two examples of sections moving along a (red) path.  The first section is alternating lines and arcs.  The second is a rectangle with rounded corners.

![createMiteredSweepSectionsSections](./assets/sweepSequence.png.jpg)

Here are those result sections assembled into RuledSweep solids and then faceted as meshes.

![createMiteredSweepSectionsAsSurfaceAndMesh](./assets/createMiteredSweepSections.jpg)

### New constructors

* [Vector3d.createNormalizedStartEnd]($core-geometry) returns (if possible) a unit vector from start to end, with start and end given as [XYAndZ]($core-geometry)
* [Matrix3d.createFlattenAlongVectorToPlane]($core-geometry) returns a matrix which sweeps vectors along given sweep vector to a plane (through the origin) through described by its normal
* [Transform.createFlattenAlongVectorToPlane]($core-geometry) returns a matrix which sweeps points along given sweep vector to a plane with given origin and normal.

* [PolylineOps.createBisectorPlanesForDistinctPoints(centerline:]($core-geometry) For each point on a polyline, constructs a plane which bisects the angle between inbound and outbound

### Bug Fix: Swept surface constructions

When constructing sweep surfaces ([LinearSweep],($core-geometry) [RotationalSweep]($core-geometry), [RuledSweep]($core-geometry)) , promote single [CurvePrimitive]($core-geometry) input to Path with one member.
