# PropertyGrid

The [PropertyGrid]($components-react:PropertyGrid) category in the `@itwin/components-react` package includes
classes and components for working with a PropertyGrid control.

## Components

The following React components comprise the PropertyGrid control.

- [PropertyGrid]($components-react) - renders property categories
- [PropertyList]($components-react) - renders multiple properties within a category as a list
- [PropertyRenderer]($components-react) - renders a property
- [PrimitivePropertyRenderer]($components-react) - renders a primitive property
- [NonPrimitivePropertyRenderer]($components-react) - renders struct and array properties
- [PropertyView]($components-react) - renders a property as a label/value pair
- [PropertyCategoryBlock]($components-react) - Expandable block for a category; uses [ExpandableBlock]($core-react) for rendering

There are a number of value renderer components for different types that can be found in the [Properties]($components-react:Properties) category.
Those components are managed by the [PropertyValueRendererManager]($components-react).

## Data Provider

The PropertyGrid data provider is defined by the [IPropertyDataProvider]($components-react) interface.
The `getData` method provides data to the PropertyGrid component via the
[PropertyData]($components-react) interface. The `onDataChanged` event should be emitted when property
data changes.

In the PropertyData interface, the `categories` member provides an array of [PropertyCategory]($components-react) and the
`records` member provides a map of [PropertyRecord]($appui-abstract) associated with each category.

The [SimplePropertyDataProvider]($components-react) class is an implementation of
IPropertyDataProvider that uses an associative array.
The [PresentationPropertyDataProvider]($presentation-components) class is a
Presentation Rules-driven implementation.
Developers may develop their own implementation of IPropertyDataProvider.

## Properties

The PropertyGrid component properties are defined by the [PropertyGridProps]($components-react) interface.

The `dataProvider` prop, which is the only mandatory prop, specifies the property data provider.

The `orientation` prop specifies the grid orientation. When the width is less than 300
(or another width specified by the`horizontalOrientationMinWidth` prop) the orientation will automatically
switch to vertical.

To support property selection, set the `isPropertySelectionEnabled` prop to true and
provide a `onPropertySelectionChanged` callback function.

To support property editing, set the `isPropertyEditingEnabled` prop to true and
provide a `onPropertyUpdated` callback function.

To support a link in a property, set the `links` member in a [PropertyRecord]($appui-abstract) and
provide a `onPropertyLinkClick` callback function.

## Sample using Presentation Rules

The following sample uses Presentation Rules and Unified Selection.

```tsx
import * as React from "react";
import { IModelConnection } from "@itwin/core-frontend";
import { Orientation, useDisposable } from "@itwin/core-react";
import { VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import { PresentationPropertyDataProvider, usePropertyDataProviderWithUnifiedSelection } from "@itwin/presentation-components";

/** React properties for the property grid component */
export interface Props {
  /** iModel whose contents should be displayed in the property grid */
  imodel: IModelConnection;
  /** ID of the presentation rule set to use for creating the content displayed in the property grid */
  rulesetId: string;
}

/** Property grid component for the viewer app */
export default function SimplePropertiesComponent(props: Props) {
  const { imodel, rulesetId } = props;
  const dataProvider = useDisposable(React.useCallback(
    () => new PresentationPropertyDataProvider({ imodel, ruleset: rulesetId }),
    [imodel, rulesetId],
  ));
  const { isOverLimit, numSelectedElements } = usePropertyDataProviderWithUnifiedSelection({ dataProvider });
  if (numSelectedElements === 0)
    return "Select at least one element";
  if (isOverLimit)
    return "Too many elements selected";
  return (
    <VirtualizedPropertyGridWithDataProvider
      orientation={Orientation.Horizontal}
      dataProvider={dataProvider}
    />
  );
}

```

## API Reference

- [VirtualizedPropertyGridWithDataProvider]($components-react)
- [Properties in @itwin/components-react]($components-react:Properties)
- [Properties in @itwin/appui-abstract]($appui-abstract:Properties)
