# Widgets

A **Widget** is a collection of UI components that allows the user to view and/or modify data relevant to their current context.
A Widget can float as a modeless dialog or be docked into one a [StagePanel]($appui-react).

A label for the Widget may be specified using the `label` or `labelKey` prop.
An icon may be specified using the `iconSpec` prop.
The `defaultState` prop specifies the default state, which defaults to `WidgetState.Open`.
An `id` prop may optionally be used to set an Id on a Widget that can be used to find the widget.

The content of the widget is ultimately a React component.
The content may be specified for the Widget component two different ways: a WidgetControl or a React component.
The `control` prop specifies a WidgetControl and the `element` prop specifies a React component.
A WidgetControl contains a `reactNode` property, which is where the React component is specified.
A WidgetControl is useful if you need to centralize some logic pertaining to the widget but outside the React component for the widget.

The `applicationData` prop specifies JSON data attached to the Widget and WidgetDef.

The `syncEventIds` and `stateFunc` props may be used to set the state of the widget based on certain events and criteria. See [SyncUi](./SyncUi.md) for more details.

## Popout Widget Support

Starting in version 2.17 Widgets can specify if they support being "popped-out" to a child window by setting the AbstractWidgetProps property `canPopout` to true. This option must be explicitly set because the property `reactNode` must return React components that works properly in a child window. At minimum components should typically not use the `window` or `document` property to register listeners as these listener will be registered for events in the main window and not in the child window. Components will need to use the `ownerDocument` and `ownerDocument.defaultView` properties to retrieve `document` and `window` properties for the child window. Below is an example of a widget specification that can be "popped-out".

```tsx
  <Widget id="RightStart2" canPopout={true} label="Example Widget" defaultState={WidgetState.Open} element={<ComponentThatSupportsPopout>} />,
```

As long as the application is using AppUi version "2" or later, a "pop-out" icon will be shown along side the widget tab(s) if the active widget tab has its `canPopout` property set to true. When this icon is pressed the contents of the widget tab will be moved from the widget panel to an independent child window that can be moved to a secondary monitor. If the user closes a "popped-out" widget it will be re-docked in the widget panel. For security reasons, browsers do not allow javascript to automatically open popup windows, so when the current page unloaded and returned to at a later time, any "popped-out" widgets are converted to floating widgets. These floating widgets can be "popped-out" again using the same "pop-out" icon. Some browsers, like Firefox, will return the popout to it last position, and other browser, like Chrome, will force the popup window to be on same screen as main browser window. If the application is an Electron-based application, the "popped-out" widgets will be restored without being converted to floating widgets.

## WidgetControls

A subclass of [WidgetControl]($appui-react) may be used to populate a widget. The `reactNode` property specifies the React component.
The `options` parameter in the constructor contains the `applicationData` from the Widget component.
The `setWidgetState` method may be called to set the state of the widget.

```tsx
import * as React from "react";

import {
  WidgetControl,
  ConfigurableCreateInfo,
} from "@itwin/appui-react";

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

A [WidgetDef]($appui-react) object is created for each Widget component in the frontstage. The WidgetDef contains properties and methods used to get information and change the state of the widget.

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

There is an extensible Tool Widget named [BasicToolWidget]($appui-react) in the appui-react package. It supports the specification of additional horizontal and vertical toolbar items via props. It provides basic selection and measuring tools and supports the specification of additional horizontal and vertical toolbar items via props.

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

There is an extensible Navigation Widget named [BasicNavigationWidget]($appui-react) in the appui-react package. It provides basic view manipulation tools and supports the specification of additional horizontal and vertical toolbar items via props.

## API Reference

- [Widget]($appui-react:Widget)
