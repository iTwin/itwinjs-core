# PropertyGrid

The [PropertyGrid]($ui-components:PropertyGrid) category in the `@bentley/ui-components` package includes
classes and components for working with a PropertyGrid control.

## Components and Properties

TODO

## Sample using Presentation Rules

The following sample is from simple-viewer-app. It uses Presentation Rules and Unified Selection.

### Defining the SimplePropertiesComponent component

This React component utilizes the [PropertyGrid]($ui-components) component and
[propertyGridWithUnifiedSelection]$(presentation-components) HOC to
create a HOC property grid component that supports unified selection.

```tsx
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Orientation } from "@bentley/ui-core";
import { PropertyGrid } from "@bentley/ui-components";
import { PresentationPropertyDataProvider, propertyGridWithUnifiedSelection } from "@bentley/presentation-components";

// create a HOC property grid component that supports unified selection
// tslint:disable-next-line:variable-name
const SimplePropertyGrid = propertyGridWithUnifiedSelection(PropertyGrid);

/** React properties for the property grid component */
export interface Props {
  /** iModel whose contents should be displayed in the property grid */
  imodel: IModelConnection;
  /** ID of the presentation rule set to use for creating the content displayed in the property grid */
  rulesetId: string;
}

/** Property grid component for the viewer app */
export default class SimplePropertiesComponent extends React.Component<Props> {
  public render() {
    const orientation = Orientation.Vertical;
    return (
      <SimplePropertyGrid
        orientation={orientation}
        dataProvider={new PresentationPropertyDataProvider(this.props.imodel, this.props.rulesetId)}
      />
    );
  }
}

```

### Using the SimplePropertiesComponent component

```tsx
const rulesetId = "Default";
. . .
<SimplePropertiesComponent imodel={this.props.imodel} rulesetId={rulesetId} />
```

## Sample using SimplePropertyDataProvider

TODO

## API Reference

* [PropertyGrid]($ui-components:PropertyGrid)
