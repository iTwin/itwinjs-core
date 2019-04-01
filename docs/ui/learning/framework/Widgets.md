# Widgets

A **Widget** is a collection of UI components tied to a particular zone that allows the user to view and/or modify data relevant to their current context.
A Widget is hosted in either a [Zone]($framework) or [StagePanel]($framework) that are part of a [Frontstage]($framework).
The [Widget]($framework) React component is listed in the `widgets` Prop of a Zone React component or a StagePanel React component.

A label for the Widget may be specified using the `label` or `labelKey` prop.
An icon may be specified using the `iconSpec` prop.
The `defaultState` prop specifies the default state, which defaults to `WidgetState.Open`.
An `id` prop may optionally be used to set an Id on a Widget that can be used to find the widget.

The content of the widget is ultimately a React component.
The content may be specified for the Widget component two different ways: a WidgetControl or a React component.
The `control` prop specifies a WidgetControl and the `element` prop specifies a React component.
A WidgetControl contains a `reactElement` property, which is where the React component is specified.
A WidgetControl is useful if you need to centralize some logic pertaining to the widget but outside the React component for the widget.

A widget may be either rectangular or free-form, and the `isFreeform` prop indicates this. The default is rectangular.
A widget may be used for the Tool Settings or the Status Bar, and the `isToolSettings` and `isStatusBar` props indicates this. The default is false for both.

To make the widget fill the available space in the zone, set the `fillZone` prop to true.

The `applicationData` prop specifies JSON data attached to the Widget and WidgetDef.

The `syncEventIds` and `stateFunc` props may be used to set the state of the widget based on certain events and criteria. See [SyncUi](./SyncUi.md) for more details.

## Example Widget component listed in a Zone component

The following example shows a single Widget component in the center-right zone.
An icon and label are specified.
The widget is to fill the available space in the zone.
The content of the widget comes from a **TreeWidget** class that subclasses WidgetControl.
`applicationData` is defined, which is provided to the WidgetControl constructor via the `options` parameter.

```TSX
        centerRight={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true}
            widgets={[
              <Widget iconSpec="icon-tree" labelKey="NineZoneSample:components.tree" fillZone={true}
                control={TreeWidget}
                applicationData={{
                  iModelConnection: NineZoneSampleApp.store.getState().sampleAppState!.currentIModelConnection,
                  rulesetId: this._rulesetId,
                }}
              />,
            ]}
          />
```

## WidgetControls

A subclass of [WidgetControl]($framework) may be used to populate a widget. The `reactElement` property specifies the React component.
The `options` parameter in the constructor contains the `applicationData` from the Widget component.
The `setWidgetState` method may called to set the state of the widget.

```TSX
import * as React from "react";

import {
  WidgetControl,
  ConfigurableCreateInfo,
} from "@bentley/ui-framework";

import SimpleTreeComponent from "../components/Tree";

/** A widget control for displaying the Tree React component */
export class TreeWidget extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (options.iModelConnection) {
      this.reactElement = <SimpleTreeComponent imodel={options.iModelConnection} rulesetId={options.rulesetId} />;
    }
  }
}
```

## WidgetDefs

A [WidgetDef]($framework) object is created for each Widget component in the frontstage. The WidgetDef contains properties and methods used to get information and change the state of the widget.

The following example demonstrates how to open a widget programmatically. The example assumes an `id` prop of "VerticalPropertyGrid" has been provided on the Widget component.

```TS
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
    if (activeFrontstageDef) {
      const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
      if (widgetDef) {
        widgetDef.setWidgetState(WidgetState.Open);
      }
    }
```

## API Reference

* [Widget]($framework:Widget)
