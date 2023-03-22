# PropertyGrid

The [PropertyGrid]($components-react:PropertyGrid) category in the `@itwin/components-react` package includes
classes and components for working with a PropertyGrid control.

## Components

The following React components comprise the PropertyGrid control.

- [VirtualizedPropertyGridWithDataProvider]($components-react) - renders categorized properties.
- [PropertyRenderer]($components-react) - renders a [PropertyRecord]($appui-abstract).
- [PropertyView]($components-react) - renders a property as a label/value pair.
- [IPropertyValueRenderer]($components-react) - renders a property value.

There are a number of [IPropertyValueRenderer]($components-react) components for different types that can be found
in the [Properties]($components-react:Properties) category. Those components are managed by the [PropertyValueRendererManager]($components-react).

## Data Provider

The properties data provider is defined by the [IPropertyDataProvider]($components-react) interface.
The `getData` method provides data to the [VirtualizedPropertyGridWithDataProvider]($components-react) component via the
[PropertyData]($components-react) interface. The `onDataChanged` event should be emitted when property
data changes.

In the [PropertyData]($components-react) interface, the `categories` member provides an array of [PropertyCategory]($components-react) and the
`records` member provides a map of [PropertyRecord]($appui-abstract) associated with each category.

The [SimplePropertyDataProvider]($components-react) class is an implementation of [IPropertyDataProvider]($components-react) that uses an
associative array. Developers may develop their own implementation of the interface.

## Sample with `SimplePropertyDataProvider`

The following sample uses [SimplePropertyDataProvider]($components-react) to feed the data into
[VirtualizedPropertyGridWithDataProvider]($components-react) component.

```ts
[[include:AppUI.VirtualizedPropertyGridWithDataProvider.UsageExample]]
```

## API Reference

- [VirtualizedPropertyGridWithDataProvider]($components-react)
- [Properties in @itwin/components-react]($components-react:Properties)
- [Properties in @itwin/appui-abstract]($appui-abstract:Properties)
