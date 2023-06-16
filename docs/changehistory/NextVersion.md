---
publish: false
---
# NextVersion

Table of contents:

- [Display](#display)
  - [Tile decoding in workers](#tile-decoding-in-workers)
  - [Smaller edge encoding](#smaller-edge-encoding)
- [Presentation](#presentation)
  - [Renderer, editor and category on calculated properties](#renderer-editor-and-category-on-calculated-properties)
- [Geometry](#geometry)
  - [Sweeping a section to a sequence of planes](#sweeping-a-section-to-a-sequence-of-planes)
  - [New constructors](#new-constructors)
  - [Swept surface constructions](#swept-surface-constructions)

## Display

### Tile decoding in workers

Producing a responsive web app requires [limiting](https://web.dev/off-main-thread/) the amount of JavaScript code executing on the main thread. To that end, we have [moved](https://github.com/iTwin/itwinjs-core/pull/5548) decoding of [tile content](https://www.itwinjs.org/learning/display/tiles/) to a worker. This helps to reduce stutter when loading a large number of tiles. We plan to move more code to workers in upcoming releases.

### Smaller edge encoding

When rendering the contents of a view with [edge display](https://www.itwinjs.org/learning/display/edgedisplay/) enabled, special [tiles](https://www.itwinjs.org/learning/display/tiles/) are requested that encode the edge geometry in addition to the surfaces. A tile containing edges can be many times bigger than the same tile containing only surfaces. iTwin.js 4.1 introduces a [new encoding scheme](https://github.com/iTwin/itwinjs-core/pull/5581) that reduces that size difference by an order of magnitude. Previously, the average tile containing edges weighed 73% more than the corresponding tile without edges; now, the average difference is only 6.7%. This reduces tile transmission times and memory usage when edge display is enabled.

## Presentation

### Renderer, editor and category on calculated properties

Previously, the [calculated properties specification](../presentation/content/CalculatedPropertiesSpecification.md) only allowed specifying property [label](../presentation/content/CalculatedPropertiesSpecification.md#attribute-label) and [value](../presentation/content/CalculatedPropertiesSpecification.md#attribute-value). Now the specification has an ability to assign [renderer](../presentation/content/CalculatedPropertiesSpecification.md#attribute-renderer), [editor](../presentation/content/CalculatedPropertiesSpecification.md#attribute-editor) and [category](../presentation/content/CalculatedPropertiesSpecification.md#attribute-categoryid) to calculated properties.

## Geometry

### Sweeping a section to a sequence of planes

A new method [CurveFactory.createMiteredSweepSections]($core-geometry) moves a section "along" a polyline path; at each vertex the section projects to the plane containing the inbound and outbound edges' bisector.

Here are two examples of sections moving along a (red) path. The first section is a stepped polyline with rounded corners. The second section is a "stadium" shape.

![createMiteredSweepSectionsSections](./assets/sweepSequence.png)

Here are those result sections assembled into `RuledSweep` solids and then faceted as meshes, illustrating optional output controlled by [MiteredSweepOptions.outputSelect]($core-geometry).

![createMiteredSweepSectionsAsSurfaceAndMesh](./assets/createMiteredSweepSections.jpg)

### New constructors

- [Vector3d.createNormalizedStartEnd]($core-geometry) returns (if possible) a unit vector from start to end, with start and end given as [XYAndZ]($core-geometry).
- [Matrix3d.createFlattenAlongVectorToPlane]($core-geometry) returns a matrix which sweeps vectors along the given sweep direction to a plane through the origin with given normal.
- [Transform.createFlattenAlongVectorToPlane]($core-geometry) returns a transform which sweeps points along the given sweep direction to a plane with given origin and normal.
- [PolylineOps.createBisectorPlanesForDistinctPoints]($core-geometry) For each point on a polyline, constructs a plane which bisects the angle between inbound and outbound segments.

### Swept surface constructions

The constructors for swept surfaces ([LinearSweep]($core-geometry), [RotationalSweep]($core-geometry), [RuledSweep]($core-geometry)) now allow [CurvePrimitive]($core-geometry) input. Internally, the curve is promoted to a `CurveChain` with one member.
