# Widgets

A **Widget** is a collection of UI components tied to a particular zone that allows the user to view and/or modify data relevant to their current context.
A Widget is hosted in either a [Zone]($ui-framework) or [StagePanel]($ui-framework) that are part of a [Frontstage]($ui-framework).
The [Widget]($ui-framework) React component is listed in the `widgets` Prop of a Zone React component or a StagePanel React component.

A label for the Widget may be specified using the `label` or `labelKey` prop.
An icon may be specified using the `iconSpec` prop.
The `defaultState` prop specifies the default state, which defaults to `WidgetState.Open`.
An `id` prop may optionally be used to set an Id on a Widget that can be used to find the widget.

The content of the widget is ultimately a React component.
The content may be specified for the Widget component two different ways: a WidgetControl or a React component.
The `control` prop specifies a WidgetControl and the `element` prop specifies a React component.
A WidgetControl contains a `reactNode` property, which is where the React component is specified.
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

```tsx
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

A subclass of [WidgetControl]($ui-framework) may be used to populate a widget. The `reactNode` property specifies the React component.
The `options` parameter in the constructor contains the `applicationData` from the Widget component.
The `setWidgetState` method may be called to set the state of the widget.

```tsx
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
      this.reactNode = <SimpleTreeComponent imodel={options.iModelConnection} rulesetId={options.rulesetId} />;
    }
  }
}
```

## WidgetDefs

A [WidgetDef]($ui-framework) object is created for each Widget component in the frontstage. The WidgetDef contains properties and methods used to get information and change the state of the widget.

The following example demonstrates how to open a widget programmatically. The example assumes an `id` prop of "VerticalPropertyGrid" has been provided on the Widget component.

```ts
const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
if (activeFrontstageDef) {
  const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
  if (widgetDef) {
    widgetDef.setWidgetState(WidgetState.Open);
  }
}
```

## Tool Widget

The Tool Widget is shown in the top left of the content area and typically holds tools to manipulate or interrogate content. The horizontal toolbar often includes context specific tools based on select items. The vertical toolbar typically contain a more fixed list of tools.

The following example show the standard way to define a Tool Widget with some standard tools.

```tsx
function SampleToolWidget () {
  const horizontalItems: CommonToolbarItem[] = ToolbarHelper.createToolbarItemsFromItemDefs([
    CoreTools.clearSelectionItemDef,
    SelectionContextToolDefinitions.hideElementsItemDef,
    SelectionContextToolDefinitions.isolateElementsItemDef,
    SelectionContextToolDefinitions.emphasizeElementsItemDef,
  ]);
  const verticalItems: CommonToolbarItem[] = ToolbarHelper.createToolbarItemsFromItemDefs([
    CoreTools.selectElementCommand,
    CoreTools.measureToolGroup,
    CoreTools.sectionToolGroup
    ]);

  return (
    <ToolWidgetComposer
      cornerItem={<BackstageAppButton />}
      horizontalToolbar={<ToolbarComposer items={horizontalItems} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Horizontal} />}
      verticalToolbar={<ToolbarComposer items={verticalItems} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Vertical} />}
    />
  );
  ```

There is an extensible Tool Widget named [BasicToolWidget]($ui-framework) in the ui-framework package. It supports the specification of additional horizontal and vertical toolbar items via props. It provides basic selection and measuring tools and supports the specification of additional horizontal and vertical toolbar items via props.

## Navigation Widget

The Navigation widget is shown in the top right of the content area and typically holds tools to visually navigate, orient, and zoom to specific content. The Navigation Widget supports both a horizontal and vertical toolbar. At the top right corner of the widget a Navigation aid can be displayed. The navigation aid is typically used to show the orientation or position of the view within the project.

The following example show the standard way to define a Navigation Widget.

```tsx
function SampleNavigationWidget () {
  const horizontalItems: CommonToolbarItem[] = ToolbarHelper.createToolbarItemsFromItemDefs([
    CoreTools.rotateViewCommand,
    CoreTools.panViewCommand,
    CoreTools.fitViewCommand,
    CoreTools.windowAreaCommand,
    CoreTools.viewUndoCommand,
    CoreTools.viewRedoCommand,
  ]);
  const verticalItems: CommonToolbarItem[] = ToolbarHelper.createToolbarItemsFromItemDefs([
    CoreTools.walkViewCommand,
    CoreTools.toggleCameraViewCommand,
    ]);

  return (
    <NavigationWidgetComposer
      horizontalToolbar={<ToolbarComposer items={horizontalItems} usage={ToolbarUsage.ViewNavigation} orientation={ToolbarOrientation.Horizontal} />}
      verticalToolbar={<ToolbarComposer items={verticalItems} usage={ToolbarUsage.ViewNavigation} orientation={ToolbarOrientation.Vertical} />}
    />
  );
```

There is an extensible Navigation Widget named [BasicNavigationWidget]($ui-framework) in the ui-framework package. It provides basic view manipulation tools and supports the specification of additional horizontal and vertical toolbar items via props.

## API Reference

- [Widget]($ui-framework:Widget)
