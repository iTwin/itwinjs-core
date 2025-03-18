# ECMixinClass

A mixin class is a special type of abstract entity class which can add properties and secondary inheritance hierarchies to an entity class. Mixin classes define concepts which span the primary entity inheritance hierarchy and they hold common property definitions. A mixin class s just a specialization of entity class that follows several rules designed to avoid issues caused my multiple inheritance:

1. Mixins may have 0 or 1 base classes.
2. Mixins may only have another mixin as a base class
3. Mixins may not override an inherited property
4. Mixins must define an entity class which limits the entity classes it can be applied to

An entity class incorporates a mixin by declaring the mixin class as a base class. An entity class may implement multiple mixins, but may only have one entity base class. Classes that incorporate mixins must also follow strict rules:

1. An entity class may only inherit from a mixin if the entity class derives from the ‘applies to’ class specified in the mixin definition.
2. An entity class may not inherit a property with the same name from the primary and mixin hierarchies
3. An entity class may not override a property inherited from a mixin
4. An entity class must put its entity base class first followed by mixins.

Mixins can be used as relationship endpoints.

## Example

Mixin class definition

```xml
<ECEntityClass typeName="ISubModeledElement" modifier="Abstract" displayLabel="Sub-Modeled Element">
    <ECCustomAttributes>
        <IsMixin xmlns="CoreCustomAttributes.01.00.03">
            <AppliesToEntityClass>Element</AppliesToEntityClass>
        </IsMixin>
    </ECCustomAttributes>
</ECEntityClass>
```

```json
"ISubModeledElement": {
  "schemaItemType": "Mixin",
  "label": "Sub-Modeled Element",
  "appliesTo": "BisCore.Element"
},
```

Mixin applied to a class definition

```xml
<ECEntityClass typeName="Drawing" description="A bis:Drawing is a bis:Document of a 2D drawing.">
    <BaseClass>Document</BaseClass>
    <BaseClass>ISubModeledElement</BaseClass>
</ECEntityClass>
```

> NOTE: In xml mixins must come after the single entity base class if it exists.

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
