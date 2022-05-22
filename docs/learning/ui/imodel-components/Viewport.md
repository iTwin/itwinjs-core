# Viewport

The [Viewport]($imodel-components-react:Viewport) category in the `@itwin/imodel-components-react` package includes
classes and components for working with a Viewport.

## Component and Properties

The [ViewportComponent]($imodel-components-react) React component is wrapper for a [ScreenViewport]($core-frontend).
The [ViewportProps]($imodel-components-react) interface defines the properties for the ViewportComponent.

The `imodel` prop is required and specifies the [IModelConnection]($core-frontend) to display.

Either the `viewDefinitionId` prop or the `viewState` prop is required to specify a starting view point.
The `viewDefinitionId` is the Id of a default view definition to load.
The `viewState` is the [ViewState]($core-frontend) to use as a starting point.

The `viewportRef` specifies a function that receives the [ScreenViewport]($core-frontend) created by the component and
allows the component user a chance to save it. When using `@itwin/appui-react` and
Frontstages, setting `ViewportContentControl.viewport` notifies the [FrontstageManager]($appui-react) that the
content view is ready.

## Sample using Presentation Rules

### Simple Viewport Component

This React component utilizes the [ViewportComponent]($imodel-components-react) component and
[viewWithUnifiedSelection]($presentation-components) HOC to
create a HOC viewport component that supports unified selection.

```tsx
import * as React from "react";
import { ViewportComponent, ViewportProps } from "@itwin/imodel-components-react";
import { viewWithUnifiedSelection } from "@itwin/presentation-components";

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

- [Viewport]($imodel-components-react:Viewport)
