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

## Classes

---

---

### GridCurve

---

An object representing a grid curve. `Gridcurve` is similar to `IfcGridAxis` in that it represents a curve geometry on a (usually planar) surface. it is also similar to Grid Curves as known in `AECOsim Building Designer`. Gridcurves can be found in submodels of `GridCurvesPortion` elements.

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
    <ECEntityClass typeName="GridLine">
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
    <ECEntityClass typeName="GridLine">
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
    <ECEntityClass typeName="GridLine">
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
    <ECEntityClass typeName="GridLine">
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

A collection of ElevationGridSurfaces. typically used to slice a building. every surface is positioned across the Z axis of ElevationGrid Placement.

<u>Naming:</u>

1.  ElevationGrid because GridSurfaces are positioned based on their .Elevation and grid .Placement properties

<u>Geometry Use:</u>

1.  no geometry
2.  Local Coordinates : defines the origin and direction for surfaces

<u>Schema:</u>

```xml
    <ECEntityClass typeName="Grid" modifier="Abstract"  description="A grid is a collection of gridsurfaces.">
      <BaseClass>bis:SpatialLocationPortion</BaseClass>
    </ECEntityClass>
```

### GridAxis

---

a subcollection of GridSurfaces in a Grid. Typically used to group parallel surfaces together.

<u>Naming:</u>

1.  matches with GridAxis in `AECOsim Building Designer`

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
