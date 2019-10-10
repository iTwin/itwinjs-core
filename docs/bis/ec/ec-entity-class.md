# ECEntityClass

ECEntityClasses make up the domain model in a schema, defining the objects which will be created and inserted into the repository. It has additional attributes over the common set.

In addition to having one base class an entity class my have any number of [Mixins](./ec-mixin-class.md) applied.

## Custom Attributes

ECEntity classes inherit custom attributes from their base class and any mixins applied.  Base classes are traversed first, followed by mixins.  When more than one custom attribute of the same class is found the first one found is the one returned.

## Additional Sub-Elements

[ECNavigationProperty](./ec-property.md#ecnavigationproperty) _(0..*)_