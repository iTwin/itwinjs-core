# Schema : Grids

This schema contains class definitions for grids.

These are used to build structural,spaceplanning and other grids. A `Grid` is a collection of GridSurfaces. Every `GridSurface` has a `GridAxis`, which is currently primarily used for grouping surfaces into subgroups. intersection of GridSurfaces may create a `GridCurve` (driven by `GridCurveBundle` element).

<u>Schema:</u>

```xml
<ECSchema schemaName="Grids" alias="grids" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECSchemaReference name="BisCore" version="01.00.00" alias="bis" />
    <ECSchemaReference name="AecUnits" version="01.00.00" alias="AECU" />
```

![Grids](./media/grids.png)
![Grids](./media/gridsystem_instance.png)

## Classes

---

---

### GridCurve

---

An object representing a grid curve. `GridCurve` is similar to `IfcGridAxis` in that it represents a curve geometry on a (usually planar) surface. it is also similar to Grid Curves as known in `AECOsim Building Designer`. Gridcurves can be found in submodels of `GridCurvesPortion` elements.

<u>Naming:</u>

1.  matches with Grid Curve in `AECOsim Building Designer`

<u>Geometry Use:</u>

1.  open `CurveVector` with a single curve
2.  Local Coordinates : origin at the start of the curve, aligned to creating `GridSurface`.

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridCurve" modifier="Abstract">
      <BaseClass>bis:SpatialLocationElement</BaseClass>
    </ECEntityClass>
```

### GridLine

---

An object representing a grid line. `GridLine` can be created by 2 intersecting instances of `GridPlanarSurface`.

<u>Naming:</u>

1.  matches with Grid Line in `AECOsim Building Designer`

<u>Geometry Use:</u>

1.  open `CurveVector` with a single line
2.  inherits from baseclass. Local Coordinates : origin at the start of the curve, aligned to creating `GridSurface`.

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridLine" description="a gridcurve that is a result of 2 planar surfaces">
      <BaseClass>GridCurve</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### GridArc

---

An object representing a grid arc. `GridArc` can be created by intersecting instances of `GridPlanarSurface` and `GridArcSurface` together.

<u>Naming:</u>

1.  matches with Grid Arc in `AECOsim Building Designer`

<u>Geometry Use:</u>

1.  open `CurveVector` with a single arc
2.  inherits from baseclass. Local Coordinates : origin at the start of the curve, aligned to creating `GridSurface`.

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridArc" description="a gridcurve that is a result of a planar and arc surface">
      <BaseClass>GridCurve</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### GridSpline

---

An object representing a grid spline. `GridSpline` can be created by intersecting instances of `GridPlanarSurface` and `GridSplineSurface` together.

<u>Naming:</u>

1.  matches with Grid Spline in `AECOsim Building Designer`

<u>Geometry Use:</u>

1.  open `CurveVector` with a single spline
2.  inherits from baseclass. Local Coordinates : origin at the start of the curve, aligned to creating `GridSurface`.

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridSpline" description="a gridcurve that is a result of a planar and a spline surface">
      <BaseClass>GridCurve</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### GeneralGridCurve

---

GridCurve representing other geometry (typically 3d splines). `GeneralGridCurve` can be created by intersecting other pairs of `GridSurface` instances.

<u>Naming:</u>

1.  matches with Grid Curve in `AECOsim Building Designer`

<u>Geometry Use:</u>

1.  open `CurveVector` with a single curve
2.  inherits from baseclass. Local Coordinates : origin at the start of the curve, aligned to creating `GridSurface`.

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GeneralGridCurve" description="a gridcurve that is a result of 2 non-planar surfaces">
      <BaseClass>GridCurve</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### Grid

---

A collection of `GridSurface` instances.

Grids known in other products like IAI IfcGrid or Grid in `AECOsim Building Designer` contain curves, rather than surfaces. However, those curves are later referenced over different elevations, which makes those elements conceptually surfaces intersecting those elevations. in BIS - `Grid` is a collection of surfaces rather than curves. curves are a result of surfaces intersecting, known as `GridCurve`. While this approach ensures compatibility with legacy grids it also is more flexible. i.e. by manipulating the .EndElevation properties of individual instances of `IPlanGridSurface` in a `PlanGrid` intersecting `ElevationGrid`, individual `GridCurve` instances could be made not to appear on higher elevations. curves could be made to appear on certain elevations by using the `GridCurveBundle` element (i.e. appear on story-1 and story-3, but skip story-2). number of axes is also unlimited in `SketchGrid`, `ElevationGrid` and `FreeGrid`.

<u>Naming:</u>

1.  Equivalent with IAI IfcGrid

<u>Geometry Use:</u>

1.  no geometry
2.  Local Coordinates : defines the origin for surfaces

<u>Schema:</u>

```xml
    <ECEntityClass typeName="Grid" modifier="Abstract"  description="A grid is a collection of gridsurfaces.">
      <BaseClass>bis:SpatialLocationPortion</BaseClass>
    </ECEntityClass>
```

### ElevationGrid

---

A collection of ElevationGridSurfaces. has one or more `GeneralGridAxis`. typically used to slice a building. every surface is positioned across the Z axis of ElevationGrid Placement.

<u>Naming:</u>

1.  ElevationGrid because GridSurfaces are positioned based on their .Elevation and grid .Placement properties

<u>Geometry Use:</u>

1.  no geometry
2.  Local Coordinates : defines the origin and direction for surfaces

<u>Properties:</u>

1.  .DefaultElevationIncrement - suggested elevation increment with which a new surface would be inserted (highest elevation surface + .DefaultElevationIncrement)
2.  .DefaultSurface2d - a suggested surface for new ElevationGridSurface, could be null

<u>Schema:</u>

```xml
    <ECEntityClass typeName="ElevationGrid" description="An ElevationGrid contains planar surfaces that are parallel to the local XY plane">
      <BaseClass>Grid</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
      <ECProperty propertyName="DefaultElevationIncrement" displayLabel="DefaultElevationIncrement" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="DefaultSurface2d" displayLabel="DefaultSurface2d" typeName="Bentley.Geometry.Common.IGeometry"/>
    </ECEntityClass>
```

### FreeGrid

---

A collection of unconstrained surfaces (`FreeGridSurface`).

<u>Naming:</u>

1.  FreeGrid because it is not constrained and can contain surfaces of any geometry and orientation

<u>Geometry Use:</u>

1.  no geometry
2.  Local Coordinates : defines the origin and direction for surfaces

<u>Schema:</u>

```xml
    <ECEntityClass typeName="FreeGrid" description="An FreeGrid contains surfaces that do not need to follow any rules">
      <BaseClass>Grid</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### PlanGrid

---

A collection of `IPlanGridSurface` elements that are single curve extrusions, sharing the extrusion direction. extrusion direction is equal to grid Z orientation

<u>Naming:</u>

1.  PlanGrid because all surfaces could be viewed as curves from a plan view

<u>Geometry Use:</u>

1.  no geometry
2.  Local Coordinates : defines the origin and direction for surfaces

<u>Properties:</u>

1.  .DefaultStartElevation - suggested start elevation for new inserted surfaces
2.  .DefaultEndElevation - suggested end elevation for new inserted surfaces

<u>Schema:</u>

```xml
    <ECEntityClass typeName="PlanGrid" modifier="Abstract" description="a grid whose surfaces are curves parallel to the local x-y plane extruded along the local z-axis">
      <BaseClass>Grid</BaseClass>
      <ECProperty propertyName="DefaultStartElevation" displayLabel="DefaultStartElevation" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="DefaultEndElevation" displayLabel="DefaultEndElevation" typeName="double" kindOfQuantity="AECU:LENGTH"/>
    </ECEntityClass>
```

### SketchGrid

---

A collection of surfaces that are <b>unconstrained</b> single curve extrusions, sharing the extrusion direction. extrusion direction is driven by grid Z orientation

<u>Naming:</u>

1.  SketchGrid because all surfaces could be "sketched" from the plan view.
2.  matches with Sketch Grid in `AECOsim Building Designer`

<u>Geometry Use:</u>

1.  no geometry
2.  Local Coordinates : defines the origin and direction for surfaces

<u>Schema:</u>

```xml
    <ECEntityClass typeName="SketchGrid" description="A SketchGrid contains surfaces whose positions are not constrained (other than being swept to the grid normal)">
      <BaseClass>PlanGrid</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### OrthogonalGrid

---

A collection of `PlanCartesianGridSurface`. has 2 axes - 1 `OrthogonalAxisX` and 1 `OrthogonalAxisY`. All surfaces in the X direction belong to `OrthogonalAxisX`, all those in the Y direction belong to `OrthogonalAxisY`.

<u>Naming:</u>

1.  matches with Orthogonal Grid in `AECOsim Building Designer`

<u>Geometry Use:</u>

1.  no geometry
2.  Local Coordinates : defines the origin and direction for surfaces

<u>Properties:</u>

1.  .DefaultCoordinateIncrementX - suggested coordinate increment in the X direction for new inserted surfaces
2.  .DefaultCoordinateIncrementY - suggested coordinate increment in the Y direction for new inserted surfaces
3.  .DefaultStartExtentX - suggested start extent in the X direction for new inserted surfaces
4.  .DefaultEndExtentX - suggested end extent in the X direction for new inserted surfaces
5.  .DefaultStartExtentY - suggested start extent in the Y direction direction for new inserted surfaces
6.  .DefaultEndExtentY - suggested end extent in the Y direction direction for new inserted surfaces

<u>Schema:</u>

```xml
    <ECEntityClass typeName="OrthogonalGrid" description="And OrthogonalGrid has all of its' surfaces orthogonal in either X or Y direction">
      <BaseClass>PlanGrid</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
      <ECProperty propertyName="DefaultCoordinateIncrementX" displayLabel="DefaultCoordinateIncrementX" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="DefaultCoordinateIncrementY" displayLabel="DefaultCoordinateIncrementY" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="DefaultStartExtentX" displayLabel="DefaultStartExtentX" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="DefaultEndExtentX" displayLabel="DefaultEndExtentX" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="DefaultStartExtentY" displayLabel="DefaultStartExtentY" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="DefaultEndExtentY" displayLabel="DefaultEndExtentY" typeName="double" kindOfQuantity="AECU:LENGTH"/>
    </ECEntityClass>
```

### RadialGrid

---

A collection of `PlanRadialGridSurface` and `PlanCircumferentialGridSurface` elements. Has 2 axes - 1 `CircularAxis` and 1 `RadialAxis`. All `PlanCircumferentialGridSurface` are in the `CircularAxis`, all `PlanRadialGridSurface` in the `RadialAxis`.
`
<u>Naming:</u>

1.  matches with Radial Grid in `AECOsim Building Designer`

<u>Geometry Use:</u>

1.  no geometry
2.  Local Coordinates : defines the origin and direction for surfaces

<u>Properties:</u>

1.  .DefaultAngleIncrement - suggested angle increment for new instances of `PlanRadialGridSurface`
2.  .DefaultRadiusIncrement - suggested radius increment for new instances of `PlanCircumferentialGridSurface`
3.  .DefaultStartAngle - suggested start angle for new instances of `PlanCircumferentialGridSurface`
4.  .DefaultEndAngle - suggested end angle for new instances of `PlanCircumferentialGridSurface`
5.  .DefaultStartRadius - suggested start radius for new instances of `PlanRadialGridSurface`
6.  .DefaultEndRadius - suggested end radius for new instances of `PlanRadialGridSurface`

<u>Schema:</u>

```xml
    <ECEntityClass typeName="RadialGrid" description="A RadialGrid consists either of arcsurfaces in radial axis or planarsurfaces in circular axis">
      <BaseClass>PlanGrid</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
      <ECProperty propertyName="DefaultAngleIncrement" displayLabel="DefaultAngleIncrement" typeName="double" kindOfQuantity="AECU:ANGLE"/>
      <ECProperty propertyName="DefaultRadiusIncrement" displayLabel="DefaultRadiusIncrement" typeName="double" kindOfQuantity="AECU:ANGLE"/>
      <ECProperty propertyName="DefaultStartAngle" displayLabel="DefaultStartAngle" typeName="double" kindOfQuantity="AECU:ANGLE"/>
      <ECProperty propertyName="DefaultEndAngle" displayLabel="DefaultEndAngle" typeName="double" kindOfQuantity="AECU:ANGLE"/>
      <ECProperty propertyName="DefaultStartRadius" displayLabel="DefaultStartRadius" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="DefaultEndRadius" displayLabel="DefaultEndRadius" typeName="double" kindOfQuantity="AECU:LENGTH"/>
    </ECEntityClass>
```

### GridAxis

---

a subcollection of GridSurfaces in a Grid. Typically used to group parallel surfaces together.

<u>Naming:</u>

1.  matches with Grid Axis in `AECOsim Building Designer`

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridAxis" modifier="Abstract">
      <BaseClass>bis:DefinitionElement</BaseClass>
      <ECProperty propertyName="Name" displayLabel="Name" typeName="string"/>
      <ECNavigationProperty propertyName="Grid" relationshipName="GridHasAxes" direction="Backward" description="Grid this axis belong to" />
    </ECEntityClass>
```

### GeneralGridAxis

---

a subcollection of `GridSurface` instances in a Grid. Used solely for grouping elements.

<u>Naming:</u>

1.  matches with Grid Axis in `AECOsim Building Designer`

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GeneralGridAxis" description="an element which groups GridSurfaces together in other grids">
      <BaseClass>GridAxis</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### OrthogonalAxisX

---

a subcollection of `PlanCartesianGridSurface` in an `OrthogonalGrid` X direction

<u>Naming:</u>

1.  named so because it is an X axis in OrthogonalGrid.

<u>Schema:</u>

```xml
    <ECEntityClass typeName="OrthogonalAxisX" description="an element which groups all PlanCartesianGridSurface in the X direction">
      <BaseClass>GridAxis</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### OrthogonalAxisY

---

a subcollection of `PlanCartesianGridSurface` in an `OrthogonalGrid` Y direction

<u>Naming:</u>

1.  named so because it is an Y axis in OrthogonalGrid.

<u>Schema:</u>

```xml
    <ECEntityClass typeName="OrthogonalAxisY" description="an element which groups all PlanCartesianGridSurface in the Y direction">
      <BaseClass>GridAxis</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### CircularAxis

---

a subcollection of `PlanCircumferentialGridSurface` in a `RadialGrid`

<u>Naming:</u>

1.  matches with Circular Axis in `AECOsim Building Designer`

<u>Schema:</u>

```xml
    <ECEntityClass typeName="CircularAxis" description="an element which groups all PlanCircumferentialGridSurface in a RadialGrid together">
      <BaseClass>GridAxis</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### RadialAxis

---

a subcollection of `PlanRadialGridSurface` in a `RadialGrid`

<u>Naming:</u>

1.  named so because it is an Y axis in OrthogonalGrid.

<u>Schema:</u>

```xml
    <ECEntityClass typeName="RadialAxis" description="an element which groups all PlanRadialGridSurface in a RadialGrid together">
      <BaseClass>GridAxis</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### GridCurvesPortion

---

A space represents a volume bounded physically or only logically. Spaces provide for certain functions to be performed within a building.

<u>Naming:</u>

1.  a `Portion` that contains `GridCurves` in the submodel

<u>Geometry Use:</u>

1.  no geometry
2.  Local Coordinates : none

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridCurvesPortion" description="a portion which holds GridCurves">
      <BaseClass>bis:SpatialLocationPortion</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### GridSurface

---

An 3dimensional surface contained in a `Grid`.

<u>Naming:</u>

1.  name GridSurface signifies that it is a surface grid element

<u>Properties:</u>

1.  .Axis - a `GridAxis` this surface belongs to.

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridSurface" modifier="Abstract" description="A grid surface element.">
      <BaseClass>bis:SpatialLocationElement</BaseClass>
      <ECNavigationProperty propertyName="Axis" relationshipName="GridAxisContainsGridSurfaces" direction="Backward" description="Axis this gridSurface belong to" />
    </ECEntityClass>
```

### IPlanGridSurface

---

a mix-in for `GridSurface` classes contained in a `PlanGrid`

<u>Naming:</u>

1.  named by combining `PlanGrid` and `GridSurface`

<u>Properties:</u>

1.  .StartElevation - start elevation for the extrusion surface
1.  .EndElevation - end elevation for the extrusion surface

<u>Schema:</u>

```xml
    <ECEntityClass typeName="IPlanGridSurface" modifier="Abstract" displayLabel="PlanGrid Surface" description="An interface that indicates that this Surface is suitable to be placed in a PlanGrid" >
      <ECCustomAttributes>
        <IsMixin xmlns="CoreCustomAttributes.01.00.00">
          <!-- Only subclasses of grids:GridSurface can implement the IPlanGridSurface interface -->
          <AppliesToEntityClass>GridSurface</AppliesToEntityClass>
        </IsMixin>
      </ECCustomAttributes>
      <ECProperty propertyName="StartElevation" displayLabel="StartElevation" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="EndElevation" displayLabel="EndElevation" typeName="double" kindOfQuantity="AECU:LENGTH"/>
    </ECEntityClass>
```

### GridPlanarSurface

---

A class for planar `GridSurface` elements.

<u>Naming:</u>

1.  named to note that this is a planar `GridSurface`

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridPlanarSurface" modifier="Abstract" description="A planar grid surface element.">
      <BaseClass>GridSurface</BaseClass>
    </ECEntityClass>
```

### ElevationGridSurface

---

a planar `GridSurface` used in `ElevationGrid`. this is the only type of `GridSurface` allowed in an ElevationGrid.

<u>Naming:</u>

1.  named by combining `ElevationGrid` and `GridSurface`

<u>Geometry Use:</u>

1.  a `CurveVector`
2.  Local Coordinates : grid coordinates + .Elevation property in Z axis

<u>Properties:</u>

1.  .Elevation - elevation this surface is located at, relative to `Grid` coordinate system.
1.  .Surface2d - a property for the 2d surface geometry.

<u>Schema:</u>

```xml
    <ECEntityClass typeName="ElevationGridSurface" description="A PlanarGridSurface that is parallel with its Grid’s x-y plane (always contained in an ElevationGrid).">
      <BaseClass>GridPlanarSurface</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
      <ECProperty propertyName="Elevation" displayLabel="Elevation" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="Surface2d" displayLabel="Surface2d" typeName="Bentley.Geometry.Common.IGeometry"/>
    </ECEntityClass>
```

### PlanGridPlanarSurface

---

A class for `GridPlanarSurface` elements used in `PlanGrid`.

<u>Naming:</u>

1.  named by combining `PlanGrid` and `GridPlanarSurface`

<u>Geometry Use:</u>

1.  a `SolidPrimitive` DgnExtrusion containing single line for base, swept from .StartElevation to .EndElevation
2.  Local Coordinates : defined by subclasses

<u>Schema:</u>

```xml
    <ECEntityClass typeName="PlanGridPlanarSurface" modifier="Abstract" description="A planar plangrid surface element.">
      <BaseClass>GridPlanarSurface</BaseClass>
      <BaseClass>IPlanGridSurface</BaseClass>
    </ECEntityClass>
```

### PlanCartesianGridSurface

---

A class for `GridSurface` contained in `OrthogonalGrid`

<u>Naming:</u>

1.  named so because it is a `GridSurface` defined by cartesian coordinates

<u>Geometry Use:</u>

1.  "inherit from parent" a `SolidPrimitive` DgnExtrusion containing single line for base, swept from .StartElevation to .EndElevation
2.  Local Coordinates : `Grid` coordinates + .Coordinate in X or Y direction depending on the type of axis

<u>Properties:</u>

1.  .Coordinate - offset from coordinate system origin. direction defined by the axis
2.  .StartExtent - start extent of the surface
3.  .EndExtent - end extent of the surface

<u>Schema:</u>

```xml
    <ECEntityClass typeName="PlanCartesianGridSurface" description="A planar plan grid surface that is perpendicular to the grid’s x-axis or y-axis.">
      <BaseClass>PlanGridPlanarSurface</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
      <ECProperty propertyName="Coordinate" displayLabel="Coordinate" typeName="double" kindOfQuantity="AECU:LENGTH" description="Origin of the surface"/>
      <ECProperty propertyName="StartExtent" displayLabel="StartExtent" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="EndExtent" displayLabel="EndExtent" typeName="double" kindOfQuantity="AECU:LENGTH"/>
    </ECEntityClass>
```

### PlanRadialGridSurface

---

A class for `GridSurface` instances of angular increments contained in `RadialGrid`

<u>Naming:</u>

1.  named so because it is a `GridSurface` defined by radial parameters

<u>Geometry Use:</u>

1.  "inherit from parent" a `SolidPrimitive` DgnExtrusion containing single line for base, swept from .StartElevation to .EndElevation
2.  Local Coordinates : `Grid` coordinates rotated by the .Angle property from Y direction, clockwise

<u>Properties:</u>

1.  .Angle - angle in the clockwise direction from the Y axis of the `RadialGrid` defining the direction of surface base line.
2.  .StartRadius - start radius of the surface
3.  .EndRadius - end radius of the surface

<u>Schema:</u>

```xml
    <ECEntityClass typeName="PlanRadialGridSurface" description="A PlanGridPlanarSurface whose infinite plane contains the PlanGrid’s origin.">
      <BaseClass>PlanGridPlanarSurface</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
      <ECProperty propertyName="Angle" displayLabel="Angle" typeName="double" kindOfQuantity="AECU:LENGTH" description="Origin of the surface"/>
      <ECProperty propertyName="StartRadius" displayLabel="StartRadius" typeName="double" kindOfQuantity="AECU:LENGTH"/>
      <ECProperty propertyName="EndRadius" displayLabel="EndRadius" typeName="double" kindOfQuantity="AECU:LENGTH"/>
    </ECEntityClass>
```

### SketchLineGridSurface

---

A class for `GridSurface` instances of sketched line surfaces in `SketchGrid`

<u>Naming:</u>

1.  named so because it is an extruded line surface in a `SketchGrid`

<u>Geometry Use:</u>

1.  "inherit from parent" a `SolidPrimitive` DgnExtrusion containing single line for base, swept from .StartElevation to .EndElevation
2.  Local Coordinates : `Grid` coordinates

<u>Properties:</u>

1.  .Line2d - line geometry used to extrude the surface - a `CurveVector` containing a single line

<u>Schema:</u>

```xml
    <ECEntityClass typeName="SketchLineGridSurface" description="An extruded line gridsurface element.">
      <BaseClass>PlanGridPlanarSurface</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
      <ECProperty propertyName="Line2d" displayLabel="Line2d" typeName="Bentley.Geometry.Common.IGeometry"/>
    </ECEntityClass>
```

### GridArcSurface

---

A `GridSurface` that is parallel to extruded arc.

<u>Naming:</u>

1.  named to note that this is an arc `GridSurface`

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridArcSurface" modifier="Abstract" description="A grid surface that is parallel to extruded arc.">
      <BaseClass>GridSurface</BaseClass>
    </ECEntityClass>
```

### PlanGridArcSurface

---

A class for `GridArcSurface` elements used in `PlanGrid`.

<u>Naming:</u>

1.  named by combining `PlanGrid` and `GridArcSurface`

<u>Geometry Use:</u>

1.  a `SolidPrimitive` DgnExtrusion containing single arc for base, swept from .StartElevation to .EndElevation
2.  Local Coordinates : defined by subclasses

<u>Schema:</u>

```xml
    <ECEntityClass typeName="PlanGridArcSurface" modifier="Abstract" description="An arc plangrid surface element.">
      <BaseClass>GridArcSurface</BaseClass>
      <BaseClass>IPlanGridSurface</BaseClass>
    </ECEntityClass>
```

### PlanCircumferentialGridSurface

---

A class for `GridSurface` instances of circular radius increments contained in `RadialGrid`

<u>Naming:</u>

1.  named so because it is a `GridSurface` defined by circumferential parameters

<u>Geometry Use:</u>

1.  "inherit from parent" a `SolidPrimitive` DgnExtrusion containing single arc for base, swept from .StartElevation to .EndElevation
2.  Local Coordinates : `Grid` coordinates

<u>Properties:</u>

1.  .Radius - radius from the `Grid` origin at which the arc surface is swept.
2.  .StartAngle - start angle of the arc surface
3.  .EndAngle - end angle of the arc surface

<u>Schema:</u>

```xml
    <ECEntityClass typeName="PlanCircumferentialGridSurface" description="An PlanGridArcSurface that is centered on the Grid’s origin.">
      <BaseClass>PlanGridArcSurface</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
      <ECProperty propertyName="Radius" displayLabel="Radius" typeName="double" kindOfQuantity="AECU:LENGTH" description="Origin of the surface"/>
      <ECProperty propertyName="StartAngle" displayLabel="StartAngle" typeName="double" kindOfQuantity="AECU:ANGLE"/>
      <ECProperty propertyName="EndAngle" displayLabel="EndAngle" typeName="double" kindOfQuantity="AECU:ANGLE"/>
    </ECEntityClass>
```

### SketchArcGridSurface

---

A class for `GridSurface` instances of sketched arc surfaces in `SketchGrid`

<u>Naming:</u>

1.  named so because it is an extruded arc surface in a `SketchGrid`

<u>Geometry Use:</u>

1.  "inherit from parent" a `SolidPrimitive` DgnExtrusion containing single arc for base, swept from .StartElevation to .EndElevation
2.  Local Coordinates : `Grid` coordinates

<u>Properties:</u>

1.  .Arc2d - arc geometry used to extrude the surface - a `CurveVector` containing a single arc

<u>Schema:</u>

```xml
    <ECEntityClass typeName="SketchArcGridSurface" description="An extruded arc gridsurface element.">
      <BaseClass>PlanGridArcSurface</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
      <ECProperty propertyName="Arc2d" displayLabel="Arc2d" typeName="Bentley.Geometry.Common.IGeometry"/>
    </ECEntityClass>
```

### GridSplineSurface

---

A `GridSurface` that is parallel to an extruded spline.

<u>Naming:</u>

1.  named to note that this is a spline `GridSurface`

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridSplineSurface" modifier="Abstract" description="A grid surface that is an extruded spline.">
      <BaseClass>GridSurface</BaseClass>
    </ECEntityClass>
```

### PlanGridSplineSurface

---

A class for `GridSplineSurface` elements used in `PlanGrid`.

<u>Naming:</u>

1.  named by combining `PlanGrid` and `GridSplineSurface`

<u>Geometry Use:</u>

1.  a `SolidPrimitive` DgnExtrusion containing single spline for base, swept from .StartElevation to .EndElevation
2.  Local Coordinates : defined by subclasses

<u>Schema:</u>

```xml
    <ECEntityClass typeName="PlanGridSplineSurface" modifier="Abstract" description="An arc plangrid surface element.">
      <BaseClass>GridSplineSurface</BaseClass>
      <BaseClass>IPlanGridSurface</BaseClass>
    </ECEntityClass>
```

### SketchSplineGridSurface

---

A class for `GridSurface` instances of sketched spline surfaces in `SketchGrid`

<u>Naming:</u>

1.  named so because it is an extruded spline surface in a `SketchGrid`

<u>Geometry Use:</u>

1.  "inherit from parent" a `SolidPrimitive` DgnExtrusion containing single spline for base, swept from .StartElevation to .EndElevation
2.  Local Coordinates : `Grid` coordinates

<u>Properties:</u>

1.  .Spline2d - spline geometry used to extrude the surface - a `CurveVector` containing a single spline

<u>Schema:</u>

```xml
    <ECEntityClass typeName="SketchSplineGridSurface" description="An extruded spline gridsurface element.">
      <BaseClass>PlanGridSplineSurface</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
      <ECProperty propertyName="Spline2d" displayLabel="Spline2d" typeName="Bentley.Geometry.Common.IGeometry"/>
    </ECEntityClass>
```

### GridCurveBundle

---

A bundle class for `GridCurve` creation. Drives the creation of GridCurve

<u>Naming:</u>

1.  a bundle for driving `GridCurve`

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridCurveBundle" displayLabel="GridCurve bundle">
      <BaseClass>bis:DriverBundleElement</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

## Relationships

---

---

### GridDrivesGridSurface

---

a driving relationship which tells that a grid is driving a gridsurface.

<u>Naming:</u>

1.  named as per standards - noting that `Grid` drives `GridSurface`.

<u>Schema:</u>

```xml
    <ECRelationshipClass typeName="GridDrivesGridSurface" modifier="None" strength="referencing" description="a driving relationship which tells that a grid is driving a gridsurface.">
      <BaseClass>bis:ElementDrivesElement</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00"/>
      </ECCustomAttributes>
      <Source multiplicity="(1..1)" roleLabel="drives" polymorphic="true">
        <Class class="Grid"/>
      </Source>
      <Target multiplicity="(0..*)" roleLabel="is driven by" polymorphic="true">
        <Class class="GridSurface"/>
      </Target>
    </ECRelationshipClass>
```

### GridSurfaceDrivesGridCurveBundle

---

a driving relationship which tells that gridsurface influences the creation of GridCurve

<u>Naming:</u>

1.  noting that `GridSurface` drives `GridCurveBundle`.

<u>Schema:</u>

```xml
    <ECRelationshipClass typeName="GridSurfaceDrivesGridCurveBundle" modifier="None" strength="referencing" description="a driving relationship which tells that gridsurface influences the creation of GridCurve">
      <BaseClass>bis:ElementDrivesElement</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00"/>
      </ECCustomAttributes>
      <Source multiplicity="(0..*)" roleLabel="influences" polymorphic="true">
        <Class class="GridSurface"/>
      </Source>
      <Target multiplicity="(0..*)" roleLabel="is influenced by" polymorphic="true">
        <Class class="GridCurveBundle"/>
      </Target>
    </ECRelationshipClass>
```

### GridCurveBundleCreatesGridCurve

---

a driving relationship which tells that gridcurve was created by the mapped GridCurveBundle

<u>Naming:</u>

1.  noting that `GridCurveBundle` creates `GridCurve`.

<u>Schema:</u>

```xml
    <ECRelationshipClass typeName="GridCurveBundleCreatesGridCurve" modifier="None" strength="referencing" description="a driving relationship which tells that gridcurve was created by the mapped GridCurveBundle">
      <BaseClass>bis:ElementDrivesElement</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00"/>
      </ECCustomAttributes>
      <Source multiplicity="(1..1)" roleLabel="creates" polymorphic="true">
        <Class class="GridCurveBundle"/>
      </Source>
      <Target multiplicity="(0..1)" roleLabel="is created by" polymorphic="true">
        <Class class="GridCurve"/>
      </Target>
    </ECRelationshipClass>
```

### GridHasAxes

---

a relationship to map grid to its axes

<u>Naming:</u>

1.  named as per standards - noting that `Grid` references `GridAxis`

<u>Schema:</u>

```xml
    <ECRelationshipClass typeName="GridHasAxes" strength="embedding" modifier="None" description="maps grid to its axes">
      <Source multiplicity="(1..1)" roleLabel="Has Axis" polymorphic="true">
        <Class class="Grid"/>
      </Source>
      <Target multiplicity="(0..*)" roleLabel="is axis of" polymorphic="true">
        <Class class="GridAxis"/>
      </Target>
    </ECRelationshipClass>
```

### GridAxisContainsGridSurfaces

---

a relationship to map grid to its axes

<u>Naming:</u>

1.  named as per standards - noting that `GridAxis` contains `GridSurface` instances.

<u>Schema:</u>

```xml
    <ECRelationshipClass typeName="GridAxisContainsGridSurfaces" modifier="None" strength="embedding" description="maps axis to grouped surfaces">
      <Source multiplicity="(1..1)" roleLabel="contains" polymorphic="true">
        <Class class="GridAxis"/>
      </Source>
      <Target multiplicity="(0..*)" roleLabel="is contained in" polymorphic="true">
        <Class class="GridSurface"/>
      </Target>
    </ECRelationshipClass>
```

## Domain Standardization of SpatialCategories

## User Control of DrawingCategories

## iModel Bridges using Grids
