---
ignore: true
---
# NextVersion

## Geometry

* New methods to reorder and reverse curves to form chains and offset loops.
  * `RegionOps.collectChains(fragments: GeometryQuery[], gapTolerance: number)`
    * For use case where there is no set expectation of whether there are one or many chains.
  * `RegionOps.collectInsideAndOutsideOffsets(fragments: GeometryQuery[], offsetDistance: number, gapTolerance: number)`
    * For use case where inputs are expected to form a loop, with clear sense of inside and outside offsetting.

## Display

### Thematic Display Optimizations

* A new `distanceCutoff` property has been added to [ThematicDisplaySensorSettingsProps]($common) and the corresponding [ThematicDisplaySensorSettings]($common) type.
  * This is a value in meters. For a position on screen to be affected by a sensor, it must be at least this close to the sensor.
    * If the distance cutoff value is specified as zero or negative, then no distance cutoff is applied (all sensors affect all positions regardless of nearness).
    * This defaults to zero if unspecified.
  * Specifying a reasonable positive value for `distanceCutoff` allows the WebGL renderer to group sensors to particular 3D tiles that are affected by those sensors. By doing this, sensors can be culled from the particular parts of the scene that they do not affect. This results in lowering the amount of work that must be done by the GPU and results in a significant performance gain in many views and zoom levels.
