# Spatial Composition

This schema describes the breakdown of `SpatialLocationElement`. It is intended to be used across disciplines. For instance it should allow to make a single composition hierarchy composing instances of `BuildableVolume` into a `Site`.The composition relationship can be applied in a recursive manner, i.e. a composed element can be composed into another composition. Cyclic references are prevented by rules in the `domain handler`. Semantically composition means that composer and composed elements describe the same thing and therefore sharing geometric location is not a conflict, it is actually expected.

![SpatialComposition](./media/composite-element.png)

## Design considerations

- This schema does not specialize any of the two available breakdown mechanisms in `BIS` (`IParent` and models). The direct reason are legacy data uploaded by [iModel bridges](./../intro/imodel-bridges.md). Reusing a `BIS` breakdown mechanism is desired but not currently available.
- Modeled and named after IFC.

## Naming considerations

- Avoid negatives, use Compose rather than Decompose.

## Schema properties

Property | Value
--|--
alias           | "spcomp"
status          | proposed
initial release | imodelhub v1.0, 2018
references      | BisCore

## Classes

### CompositeElement

A spatial element that may be Composite of other CompositeElements
*TODO like to derive from IParentElement.*

```xml
    <ECEntityClass typeName="CompositeElement" modifier="Abstract">
        <BaseClass>bis:SpatialLocationElement</BaseClass>
        <ECNavigationProperty propertyName="ComposingElement" relationshipName="CompositeComposesSubComposites" direction="Backward" description="The Composite Element" />
    </ECEntityClass>
```

### CompositeBoundary

A CompositeElement that is delimited by a curve

```xml
    <ECEntityClass typeName="CompositeBoundary" modifier="Abstract">
        <BaseClass>CompositeElement</BaseClass>
    </ECEntityClass>
```

### CompositeVolume

A CompositeElement that is delimited by a volume

```xml
    <ECEntityClass typeName="CompositeVolume" modifier="Abstract">
        <BaseClass>CompositeElement</BaseClass>
    </ECEntityClass>
```

## Relationships

### CompositeComposesSubComposites

*TODO like to derive from `IElementOwnsChildElements`.*

Relates the Composer with its' composees

```xml
    <ECRelationshipClass typeName="CompositeComposesSubComposites" strength="embedding" modifier="None">
      <!-- Relationship that indicates a decomposition of child CompositeElement -->
      <Source multiplicity="(0..1)" roleLabel="composes" polymorphic="true">
        <Class class="CompositeElement"/>
      </Source>
      <Target multiplicity="(0..*)" roleLabel="is part of" polymorphic="true">
        <Class class="CompositeElement"/>
      </Target>
    </ECRelationshipClass>
```

### CompositeOverlapsSpatialElements

A relationship to mark that an element is at least partially contained within the CompositeElement

```xml
    <ECRelationshipClass typeName="CompositeOverlapsSpatialElements" modifier="None" strength="referencing">
      <BaseClass>bis:ElementRefersToElements</BaseClass>
        <Source multiplicity="(0..*)" roleLabel="contains" polymorphic="true">
            <Class class="CompositeElement"/>
        </Source>
        <Target multiplicity="(0..*)" roleLabel="is contained by" polymorphic="true">
            <Class class="bis:SpatialElement"/>
        </Target>
    </ECRelationshipClass>
```

## CodeValue

## Category CodeScope

## iModel Bridges and instances of CompositeElement
