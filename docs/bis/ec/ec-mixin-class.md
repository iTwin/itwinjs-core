# ECMixinClass

A mixin is a special type of abstract class that can add properties and secondary inheritance hierarchies to an entity class. Mixin classes define concepts which cut across the primary entity inheritance hierarchy. They can hold common property definitions and be used as relationship endpoints. Mixin classes follow several rules in addition to standard entity class rules designed to avoid issues caused my multiple inheritance:

1. Mixins may have 0 or 1 base classes.
2. Mixins may only have another mixin as a base class
3. Mixins may not override an inherited property
4. Mixins must define an entity class which limits the entity classes it can be applied to

An entity class may implement multiple mixins, but may only have one entity base class. Classes that incorporate mixins must also follow strict rules:

1. An entity class may only inherit from a mixin if the entity class derives from the ‘applies to’ class specified in the mixin definition.
2. An entity class may not inherit a property with the same name from the primary and mixin hierarchies
3. An entity class may not override a property inherited from a mixin
4. An entity class must put its entity base class first followed by mixins in xml.

Mixins can be used as relationship endpoints with the same rules as any abstract entity class..

## Examples

### Mixin class definition

```xml
<ECEntityClass typeName="ISubModeledElement" modifier="Abstract" displayLabel="Sub-Modeled Element">
    <ECCustomAttributes>
        <IsMixin xmlns="CoreCustomAttributes.01.00.03">
            <AppliesToEntityClass>Element</AppliesToEntityClass>
        </IsMixin>
    </ECCustomAttributes>
</ECEntityClass>
```

> In xml mixins are represented as Entity Classes with a special custom attribute

```json
"ISubModeledElement": {
  "schemaItemType": "Mixin",
  "label": "Sub-Modeled Element",
  "appliesTo": "BisCore.Element"
},
```

> In json mixins are represented with a first class schema item type.

### Mixin applied to a class definition

```xml
<ECEntityClass typeName="Drawing" description="A bis:Drawing is a bis:Document of a 2D drawing.">
    <BaseClass>Document</BaseClass>
    <BaseClass>ISubModeledElement</BaseClass>
</ECEntityClass>
```

> In xml mixins must come after the single entity base class if it exists.  Multiple entity base classes are disallowed by validation logic in the code.

```json
"Drawing": {
  "schemaItemType": "EntityClass",
  "description": "A bis:Drawing is a bis:Document of a 2D drawing.",
  "baseClass": "BisCore.Document",
  "mixins": [
    "BisCore.ISubModeledElement"
  ]
},
```

> In json mixins are entered in their own array and base class is stored as a string so the format implicitly does not allow multiple base classes.
