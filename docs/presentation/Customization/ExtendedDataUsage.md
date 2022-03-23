# Using extended data

This page explains how to leverage data injected into presentation data objects using [extended data rule](./ExtendedDataRule.md) to customize information shown in our UIComponents.

## Customize tree node item icon

In order to add icon for [TreeNodeItem]($components-react) based on ECInstance we need to assign node icon with Presentation Rules. This is achievable using [ExtendedDataRule](./ExtendedDataRule.md):

```json
...
{
  "ruleType": "ExtendedData",
  "condition": "ThisNode.IsOfClass(\"SomeClass\", \"SomeSchema\")",
  "items": {
    "iconName": "\"my-custom-icon\""
  }
}
...
```

Now [Node]($presentation-common) created using Presentation Rules will have `extendedData` property with icon name. In order to map this icon name onto [TreeNodeItem]($components-react) we need to provide `customizeTreeNodeItem` function to [PresentationTreeDataProvider]($presentation-components):

```ts
[[include:Presentation.TreeDataProvider.Customization.Icon]]
```

## Customize tree node item checkbox

In order to add checkbox for [TreeNodeItem]($components-react) based on ECInstance property value we need to define which property should be used with Presentation Rules. This is achievable using [ExtendedDataRule](./ExtendedDataRule.md):

```json
...
{
  "ruleType": "ExtendedData",
  "condition": "ThisNode.IsOfClass(\"SomeClass\", \"SomeSchema\")",
  "items": {
    "showCheckbox": "TRUE",
    "isChecked": "this.SomeProperty",
    "disableCheckbox": "ThisNode.IsOfClass(\"SomeDerivedClass\", \"SomeSchema\")"
  }
}
...
```

Now [Node]($presentation-common) created using Presentation Rules will have `extendedData` property set with checkbox data. To map this data onto [TreeNodeItem]($components-react) we need to provide `customizeTreeNodeItem` function to [PresentationTreeDataProvider]($presentation-components):

```ts
[[include:Presentation.TreeDataProvider.Customization.Checkbox]]
```

## Customize tree node item style

In order to change [TreeNodeItem]($components-react) style based on ECInstance we need to define style with Presentation Rules. This is achievable using [ExtendedDataRule](./ExtendedDataRule.md):

```json
...
{
  "ruleType": "ExtendedData",
  "condition": "ThisNode.IsOfClass(\"SomeClass\", \"SomeSchema\")",
  "items": {
    "isBold": "this.SomeProperty",
    "isItalic": "TRUE",
    "color": "iif(ThisNode.SomeOtherProperty, 128, 0)"
  }
}
...
```

Now [Node](#presentation-common) created using Presentation Rules will have `extendedData` property set with style data. To map this data onto [TreeNodeItem]($components-react) we need to provide `customizeTreeNodeItem` function to [PresentationTreeDataProvider]($presentation-components):

```ts
[[include:Presentation.TreeDataProvider.Customization.Style]]
```
