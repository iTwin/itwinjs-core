# Schema : Grids

This schema contains class definitions for grids.

These are used to build structural,spaceplanning and other grids. A `Grid` is a collection of GridSurfaces. Every `GridSurface` has a `GridAxis`, which is currently primarily used for grouping surfaces into subgroupsidSurfaceCreatesGridCurve` relationship).
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

An object representing a gridcurve. Gridcurve is similar to `IfcGridAxis` in that it represents a curve geometry on a (usually planar) surface. it is also similar to Grid Curves as known in `AECOsim Building Designer`. Gridcurves can be found in submodels of `GridCurvesPortion` elements.

<u>Naming:</u>

1.  matches with GridCurve in `AECOsim Building Designer`

<u>Geometry Use:</u>

1.  open `CurveVector` with a single curve
2.  Local Coordinates : origin at the start of the curve, aligned to creating `GridSurface`.

<u>Schema:</u>

```xml
    <ECEntityClass typeName="GridCurve" modifier="Abstract">
      <BaseClass>bis:SpatialLocationElement</BaseClass>
    </ECEntityClass>
```

### Grid

---

A collection of GridSurfaces.

Naming :

1.  Equivalent with IAI IfcGrid

<u>Geometry Use:</u>

1.  no geometrdinates : defines the origin for surfaces
    <u>Schema:</u>

```xml
    <ECEntityClass typeName="Grid" modifier="Abstract"  description="A grid is a collection of gridsurfaces.">
      <BaseClass>bis:SpatialLocationPortion</BaseClass>
    </ECEntityClass>
```

### GridAxis

---

a subcollection of GridSurfaces in a Grid. Typically used to group parallel surfaces together.

<u>Naming:</u>th GridAxis in `AECOsim Building Designer`
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

Naming :

1.  a `Portion` that contains `GridCurves`

<u>Geometry Use:</u>

1.  2d closed `CurveVector` defining a volume when combined with height property.
    ![SpaceGeometryUse2d](./media/IfcSpace_2D-Layout1.gif)

2.  3d volume.
    ![SpaceGeometryUse2d](./media/IfcSpace_Standard-Layout1.gif)

3.  Holesdinates : z points away from the center of the earth.
    <u>Schema:</u>

```xml
    <ECEntityClass typeName="Space" displayLabel="Space">
        <BaseClass>spcomp:ComposedVolume</BaseClass>
        <ECCustomAttributes>
            <ClassHasHandler xmlns="BisCore.01.00" />
        </ECCustomAttributes>
    </ECEntityClass>
```

## Relationships

---

---

### SpaceHasAdjacentSpaces

Defines space adjacencies for spaces bounded by walls.

Naming :

1.  Sometimes r space functions like corridor.
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
