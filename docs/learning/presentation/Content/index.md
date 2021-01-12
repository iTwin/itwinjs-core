# Content-related Rules

There are 2 primary concepts for creating content: rules and specifications.

## Rules

Define *if* specific set of specifications should be used to create content for specific instances:

- [ContentRule](./ContentRule.md) is a container for [specifications](#specifications) that produce content.
- [ContentModifier](./ContentModifier.md) is a container for [modifiers](#modifiers) that are applied to all content produced by content rules and specifications.

## Specifications

Define *what content* is returned. There are 3 types of specifications:

- [SelectedNodeInstances](./SelectedNodeInstances.md)
- [ContentInstancesOfSpecificClasses](./ContentInstancesOfSpecificClasses.md)
- [ContentRelatedInstances](./ContentRelatedInstances.md)

Multiple specifications can contribute to the same content rule if:

- There are multiple of them specified in a single rule
- There are multiple rules whose condition returns `true`

## Modifiers

Content modifiers allow modifying content by hiding or showing properties, including additional ones,
or specifying custom renderers and editors.

- [CalculatedProperties](./CalculatedPropertiesSpecification.md)
- [RelatedProperties](./RelatedPropertiesSpecification.md)
- [PropertyCategory](./PropertyCategorySpecification.md)
- [PropertyOverrides](./PropertySpecification.md)

Modifiers can be specified as part of [content specifications](#specifications) or [content modifiers](#rules).
