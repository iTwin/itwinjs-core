# Mixins

Mixins play a key role in supporting cross-discipline coordination in BIS.

<!-- TODO: Internal details? Remove?
In the future, EC will be enhanced to have a formal interface feature, and BIS will take advantage of that capability. For the short term (BIM02) EC Mixin classes, custom attributes and schema validators will provide similar functionality.
-->

A Mixin is an abstract EC class that follows a strict set of requirements that are intended to provide the desired functionality while minimizing confusion and implementation costs. The requirements may be relaxed in the future if use cases supporting relaxation are found. The requirements for a Mixin class are as follows:

1. Mixins are abstract EC Entity classes.
2. Mixins may have 0 or 1 base classes. If there is a base class, it must be another Mixin.
3. Mixins must have the IsMixin custom attribute defined.
4. Mixins may not override an inherited property.

The Mixin custom attribute is defined as follows:

```xml
<ECCustomAttributeClass typeName="IsMixin" description="Applied to abstract ECEntityClasses which serve as secondary base classes for normal ECEntityClasses." displayLabel="Is Mixin" appliesTo="EntityClass" modifier="Sealed" >
    <ECProperty propertyName="AppliesToEntityClass" typeName="string" description="This mixin may only be applied to entity classes which derive from is class.  Class Name should be fully specified as 'alias:ClassName'" />
</ECCustomAttributeClass>
```

A class incorporates a Mixin by declaring the Mixin class as a base class. An Mixin is never the first base class listed (that position is reserved for the “real” base class). A class may implement multiple Mixins, but may only have one “real” base class. Classes that incorporate Mixins must also follow strict rules:

1. The incorporating class must descend from the AppliesToEntityClass defined in the IsMixin custom attribute.
2. The implementing class must not have an EC property (including inherited properties) that has the same name as a Mixin property.

Mixins can be used as relationship endpoints.

<!-- TODO: Internal implementation details? Remove?
The rules for Mixins and the classes that incorporate Mixins will be enforced by two mechanisms:

1. The EC Schema Editor will validate BIS schemas as they are edited.
2. An automated (likely Firebug) build will continually check all BIS schemas for conformance.
-->

By convention, interface-like Mixin classes have class names with an “I” prefix. Interface-like Mixins satisfy one or more of the following criteria:

1. The Mixin is expected to be used as a relationship endpoint.
2. The Mixin is expected to be used by code or logic that will not know which class has incorporated the Mixin.
3. The Mixin has no properties and is used as a *marker* class.
