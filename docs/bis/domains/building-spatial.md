# Schema : Building Spatial

This schema contains specialized classes of `CompositeElement` for the building domain.
They are used to build the spatial structure of a building (that serves as the primary project breakdown and is required to be hierarchical). The spatial structure elements are linked together by using the relationship [CompositeComposesSubComposites](./spatial-composition.md) in the following way: `Site`->`BuildabeVolume`->`Building`->`Story`->`Space`.

```xml
<ECSchema schemaName="BuildingSpatial" alias="bsptl" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
    <ECSchemaReference name="SpatialComposition" version="01.00" alias="spcomp" />
```

![SpatialComposition](./media/building-spatial.png)

## Classes

### BuildableVolume

A civil `BuildableVolume` also known as Sub-Site. The portion of a site that can be used for buildings and facilities like parking lots.

Naming:
1 - Matches with IAI `IfcSite` (with IfcElementCompositionEnum:PARTIAL).

Geometry Use:
1 - 3d solid or extruded closed `CurveVector`
3 - Local Coordinates : z points away from the center of the earth.

```xml
    <ECEntityClass typeName="BuildableVolume" displayLabel="BuildableVolume">
      <!-- Site may contain multiple BuildableVolumes <...> does not only contain buildings may also contain ParkingLot -->
        <BaseClass>spcomp:ComposedVolume</BaseClass>
        <BaseClass>bis:ISubModeledElement</BaseClass>
        <ECCustomAttributes>
            <ClassHasHandler xmlns="BisCore.01.00" />
        </ECCustomAttributes>
    </ECEntityClass>
```

### Building

A spatial aspect class of a real-world Building object. A building is construction work that has the provision of shelter for its occupants or contents.

Naming :
1 - Equivalent with IAI IfcBuilding

Geometry Use:
1 - 3d solid for arbitrary geometry or swept closed curve vector.
3 - Local Coordinates : z points away from the center of the earth.

```xml
    <ECEntityClass typeName="Building" displayLabel="Building">
        <BaseClass>spcomp:ComposedVolume</BaseClass>
        <BaseClass>bis:ISubModeledElement</BaseClass>
        <ECCustomAttributes>
            <ClassHasHandler xmlns="BisCore.01.00" />
        </ECCustomAttributes>
    </ECEntityClass>
```

### Story

A Spatial aspect class of a real-world Story object. The building story has an elevation and typically represents a (nearly) horizontal aggregation of spaces that are vertically bound.

Naming:
1 - Equivalent with IAI IfcBuildingStorey

Geometry Use:
1 -
3 - Local Coordinates : z points away from the center of the earth.

```xml
    <ECEntityClass typeName="Story" displayLabel="Story">
      <BaseClass>spcomp:ComposedVolume</BaseClass>
      <BaseClass>bis:ISubModeledElement</BaseClass>
      <ECCustomAttributes>
        <ClassHasHandler xmlns="BisCore.01.00" />
      </ECCustomAttributes>
    </ECEntityClass>
```

### Space

A space represents a volume bounded physically or only logically. Spaces provide for certain functions to be performed within a building.

Naming :
1 - Equivalent with IAI IfcSpace

Geometry Use:
1 - 2d closed `CurveVector` defining a volume when combined with height property.
![SpaceGeometryUse2d](./media/IfcSpace_2D-Layout1.gif)
2 - 3d volume.
![SpaceGeometryUse2d](./media/IfcSpace_Standard-Layout1.gif)
3 - Holes
4 - Local Coordinates : z points away from the center of the earth.

```xml
    <ECEntityClass typeName="Space" displayLabel="Space">
        <BaseClass>spcomp:ComposedVolume</BaseClass>
        <ECCustomAttributes>
            <ClassHasHandler xmlns="BisCore.01.00" />
        </ECCustomAttributes>
    </ECEntityClass>
```

## Relationships

### SpaceHasAdjacentSpaces

Defines space adjacencies for spaces bounded by walls.

Naming :
1 - Sometimes referred to as Room, space is a more general term including other space functions like corridor.

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

Name|Value
--|--
CodeValue|NULL
CodeScope|CodeScopeSpec::Repository
CodeSpec|bis:NullCodeSpec

## Domain Standardization of SpatialCategories

## User Control of DrawingCategories

## iModel Bridges using BuildingSpatial
