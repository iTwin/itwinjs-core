# Content

The Presentation library provides a declarative way to create content for tables, property grid and other content components based on iModel data.

## Reference

There are 2 primary concepts for creating content: [rules](#rules) and [specifications](#specifications).

### Rules

There are two types of content rules:

- [Content rule](./ContentRule.md) is a container for [specifications](#specifications) that produce content.
- [Content modifier](./ContentModifier.md) is a container for [modifiers](#modifiers) that are applied to all content produced by [content rules](./ContentRule.md) and their [specifications](#specifications).

Both rules have *picking attributes* to specify what [input](./Terminology.md#input-instance) the rule applies to.

### Specifications

Content specifications define **result of the rule** if it does get used after evaluating it's [condition](./ContentRule.md#attribute-condition) and other *picking attributes*. There are 3 types of specifications:

- [Selected node instances](./SelectedNodeInstances.md) specification returns properties of the [input instance](./Terminology.md#input-instance).
- [Content instances of specific classes](./ContentInstancesOfSpecificClasses.md) specification returns properties of instances of given classes. The returned content doesn't depend on the [input](./Terminology.md#input-instance).
- [Content related instances](./ContentRelatedInstances.md) specification returns properties of instances that are related to [input instances](./Terminology.md#input-instance) through given relationship(s).

### Modifiers

Content modifiers allow modifying content by hiding or showing properties, including additional ones, or specifying custom renderers and editors. Available modifiers:

- [Calculated properties](./CalculatedPropertiesSpecification.md) specification allows creating a calculated property.
- [Related properties](./RelatedPropertiesSpecification.md) specification allows including properties of related instances.
- [Property category](./PropertyCategorySpecification.md) specification allows grouping properties under custom categories.
- [Property overrides](./PropertySpecification.md) allow customizing display of specific properties - hiding them, changing label, category, renderer, editor.

Modifiers can be specified as part of [content specifications](#specifications) or [content modifiers](./ContentModifier.md).

## External Resources

- [Retrieving properties in different ways](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=property-formatting-sample)
- [Using element properties API to display properties in custom component](https://www.itwinjs.org/sandboxes/grigas/Element%20Properties%20Loader)
