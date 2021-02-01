# Viewport

The [Viewport]($ui-components:Viewport) category in the `@bentley/ui-components` package includes
classes and components for working with a Viewport.

## Component and Properties

The [ViewportComponent]($ui-components) React component is wrapper for a [ScreenViewport]($imodeljs-frontend).
The [ViewportProps]($ui-components) interface defines the properties for the ViewportComponent.

The `imodel` prop is required and specifies the [IModelConnection]($imodeljs-frontend) to display.

Either the `viewDefinitionId` prop or the `viewState` prop is required to specify a starting view point.
The `viewDefinitionId` is the Id of a default view definition to load.
The `viewState` is the [ViewState]($imodeljs-frontend) to use as a starting point.

The `viewportRef` specifies a function that receives the [ScreenViewport]($imodeljs-frontend) created by the component and
allows the component user a chance to save it. When using `@bentley/ui-framework` and
Frontstages, setting `ViewportContentControl.viewport` notifies the [FrontstageManager]($ui-framework) that the
content view is ready.

## Sample using Presentation Rules

### Simple Viewport Component

This React component utilizes the [ViewportComponent]($ui-components) component and
[viewWithUnifiedSelection]($presentation-components) HOC to
create a HOC viewport component that supports unified selection.

```tsx
import * as React from "react";
import { ViewportComponent, ViewportProps } from "@bentley/ui-components";
import { viewWithUnifiedSelection } from "@bentley/presentation-components";

// create a HOC viewport component that supports unified selection
// eslint-disable-next-line @typescript-eslint/naming-convention
const SimpleViewport = viewWithUnifiedSelection(ViewportComponent);

/** React properties for the viewport component */
export interface SimpleViewportComponentProps extends ViewportProps {
  /** ID of the presentation rule set to use for unified selection */
  rulesetId: string;
}

/** Viewport component for the viewer app */
export default class SimpleViewportComponent extends React.Component<SimpleViewportComponentProps> {
  public render() {
    return (
      <SimpleViewport
        viewportRef={this.props.viewportRef}
        imodel={this.props.imodel}
        viewDefinitionId={this.props.viewDefinitionId}
        viewState={this.props.viewState}
        ruleset={this.props.rulesetId}
      />
    );
  }
}
```

### Using the SimpleViewportComponent component

```tsx
const rulesetId = "Default";
. . .
<SimpleViewportComponent
  imodel={this.props.imodel}
  rulesetId={rulesetId}
  viewDefinitionId={this.props.viewDefinitionId} />
```

## API Reference

- [Viewport]($ui-components:Viewport)
