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

Mixins can be used as relationship endpoints.