# Schema : Grids

This schema contains class definitions for grids.

These are used to build structural,spaceplanning and other grids. A `Grid` is a collection of GridSurfaces. Every `GridSurface` has a `GridAxis`, which is currently primarily used for grouping surfaces into subgroups. intersection of GridSurfaces may create a `GridCurve` (driven by `GridSurfaceCreatesGridCurve` relationship).

<u>Schema:</u>

```xml
<ECSchema schemaName="Grids" alias="grids" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECSchemaReference name="BisCore" version="01.00.00" alias="bis" />
    <ECSchemaReference name="AecUnits" version="01.00.00" alias="AECU" />
```

![Grids](./media/grids.png)
![Grids](./media/grids_instance.png)

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

A collection of GridSurfaces.

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

A collection of `PlanRadialGridSurface` and `PlanCircumferentialGridSurface` elements. Has 2 axes - 1 `CircularAxis` and 1 `RadialAxis`. All `PlanRadialGridSurface` are in the `CircularAxis`, all `PlanCircumferentialGridSurface` in the `RadialAxis`.
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

### GridCurvesPortion

---

A space represents a volume bounded physically or only logically. Spaces provide for certain functions to be performed within a building.

<u>Naming:</u>

1.  a `Portion` that contains `GridCurves` in the submodel

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridCurvesPortion" description="a portion which holds GridCurves">
      <BaseClass>bis:SpatialLocationPortion</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

## Relationships

---

---

### SpaceHasAdjacentSpaces

Defines space adjacencies for spaces bounded by walls.

<u>Naming:</u>

1.  Sometimes referred to as Room, space is a more general term including other space functions like corridor.

<u>Schema:</u>

```xml
    <ECRelationshipClass typeName="SpaceHasAdjacentSpaces" modifier="None" strength="referencing">
      <BaseClass>bis:ElementRefersToElements</BaseClass>
        <Source multiplicity="(0..*)" roleLabel="is adjacent to" polymorphic="true">
            <Class class="Space"/>
        </Source>
        <Target multiplicity="(0..*)" roleLabel="is adjacent to" polymorphic="true">
            <Class class="Space"/>
        </Target>
    </ECRelationshipClass>
```

## Code

| Name      | Value                     |
| --------- | ------------------------- |
| CodeValue | NULL                      |
| CodeScope | CodeScopeSpec::Repository |
| CodeSpec  | bis:NullCodeSpec          |

## Domain Standardization of SpatialCategories

## User Control of DrawingCategories

## iModel Bridges using BuildingSpatial
