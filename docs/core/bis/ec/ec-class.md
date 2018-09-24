# ECClass

There are 5 types of ECClass in ECObjects, [ECEntityClass](./ec-entity-class.md), [ECMixinClass](./ec-mixin-class.md), [ECStructClass](./ec-struct-class.md), [ECCustomAttributeClass](./ec-custom-attribute-class.md) and [ECRelationshipClass](./ec-relationship-class.md). This section will cover what is common among all ECClass types.

Each class type models a different type of object. ECEntityClass models business objects, which are individually instantiable and have an Id. ECStructClass models complex property types, often known as structs. ECCustomAttributeClass models objects which are applied to other schema elements in order to provide additional metadata. ECRelationshipClass models connections between ECEntityClasses.

All classes support inheritance within their own class type. Therefore, an ECEntityClass can have another ECEntityClass as its base class, but could not have an ECStructClass as the base class. ECRelationshipClass only supports single inheritance while ECEntityClass supports a limited form of multi-inheritance using 'mixins'.

## Common Class Attributes

**typeName** defines the name of this ECClass. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.

**description** User facing description of the class. Localized and may be shown in the UI.

**displayLabel** a localized display label that will be used instead of the name in the GUI. If not set the Type Name of the class will be used.

**modifier** identifies the class as abstract or sealed.
- Valid options are:

  - None (default) – normal, instantiable class. Not valid for ECRelationshipClass type.
  - Abstract – abstract class, cannot be instantiated.
  - Sealed – normal, instantiable class but cannot be used as a base class or have children

## Common Sub-Elements

[ECCustomAttributes](./ec-custom-attributes.md) _(0..1)_

BaseClass _(0..*)_

- The multiplicity of base classes changes depending on the individual ECClass Type.

[ECPrimitiveProperty](./ec-property.md#ecprimitiveproperty) _(0..*)_

[ECStructProperty](./ec-property.md#ecstructproperty) _(0..*)_

[ECArrayProperty](./ec-property.md#ecprimitivearrayproperty) _(0..*)_

[ECStructArrayProperty](./ec-property.md#ecstructarrayproperty) _(0..*)_

## Traversal Order of Base ECClasses

Base classes are traversed in a depth-first fashion for all purposes, including property inheritance (and the first occurrence of a given named ECProperty “wins”). For example, given this abbreviated set of ECClass definitions:

```xml
<ECEntityClass typeName="Root"/> //Defines a property "A"

<ECEntityClass typeName="B1">
  <BaseClass>Root</BaseClass>
</ECEntityClass>

<ECEntityClass typeName="B2"/> // Defines a property "A"

<ECEntityClass typeName="Foo">
  <BaseClass>B1</BaseClass>
  <BaseClass>B2</BaseClass>
</ECEntityClass>
```

The traversal order will be: Foo, B1, Root, B2, and Root’s definition of property "A" will "win", but if Foo were defined with B2 first:

```xml
<ECEntityClass typeName="Foo">
  <BaseClass>B2</BaseClass>
  <BaseClass>B1</BaseClass>
</ECEntityClass>
```

The traversal order will be: Foo, B2, B1, Root and B2’s definition of property "A" will "win". If we introduce the "diamond pattern" via multiple inheritance by adding "Root" as a BaseClass of B2, the traversal order (using our second definition of Foo) would be: Foo, B2, Root, B1, Root. If a polymorphic algorithm were looking for subclasses of "Root", it would stop when it hit "Root" the first time.