---
tableRowAnchors: true
jotform: true
---

# Configure Frontstage

**Frontstage** is a layout configuration that resembles a page and allows you to define and implement a layout tailored to a specific task within an application. The configuration provides flexibility and control over the visual presentation of content allowing you to create task-specific page layout that enhances user experience. AppUI provides a standard layout, but a custom layout can be defined and used by the frontstage.

> _Here is a frontstage that you can interact with. Give it a try!_
>
> <iframe style="width:100%;height:400px" src="https://itwin.github.io/appui/storybook/iframe.html?args=&id=frontstage-frontstageprovider--overview&viewMode=story"></iframe>

To create a **frontstage** extend a [FrontstageProvider]($appui-react) and implement the [FrontstageProvider.frontstageConfig]($appui-react).

```tsx
[[include:AppUI.FrontstageProvider.Imports]]

[[include:AppUI.FrontstageProvider]]
```

Learn more about [creating content controls](./define-content.md#content-control).

To register a frontstage use [FrameworkFrontstages.addFrontstageProvider]($appui-react).

```tsx
[[include:AppUI.Frontstage.Register.Imports]]

[[include:AppUI.Frontstage.Register]]
```

## Activate Frontstage

To display a frontstage on the screen activate it by using the [FrameworkFrontstages.setActiveFrontstage]($appui-react).

```tsx
[[include:AppUI.Frontstage.Activate.Imports]]

[[include:AppUI.Frontstage.Activate]]
```

## Frontstage Types

| Type        | Description                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary** | Represents the task that the user is engaged with. Usually it contains an entry point to the Backstage from where other primary frontstages can be activated. |
| **Nested**  | Overlays other frontstages. Usually it is used for a specific sub-task of a primary frontstage and contains a button to return to the overlayed frontstage.   |
| **Modal**   | Dedicated frontstage overlay that is used for application settings and data management user interfaces.                                                       |

## Standard Frontstage Layout

A standard layout of **AppUI** is a widget based user interface in which the user is in control of how the content is displayed on the screen.
Each frontstage has up to four stage panels that are displayed on the side of the page. Each stage panel is divided into two sections.
Additionally a frontstage can contain multiple floating widgets that are not docked to the side of the page.
Each floating widget and a stage panel section is a widget container which can contain multiple widgets.

> _Give it a try!_
>
> <iframe style="width:100%;height:400px" src="https://itwin.github.io/appui/storybook/iframe.html?args=&id=frontstage-frontstageprovider--widget-container&viewMode=story"></iframe>

To define a frontstage configuration of a standard layout use the [StandardFrontstageProvider]($appui-react).

```tsx
[[include:AppUI.StandardFrontstageProvider.Imports]]

[[include:AppUI.StandardFrontstageProvider]]
```

## User Interactions

While defining a standard layout you have the capability to provide an initial configuration however the user is in control of most of the UI elements on the screen.

<iframe style="width:100%;height:400px" src="https://itwin.github.io/appui/storybook/iframe.html?args=&id=frontstage-frontstageprovider--interaction&viewMode=story"></iframe>

Available user interactions:

- **Dock/undock a widget** - drag a widget and drop it on one of widget targets. You can drag a widget tab or a widget title bar. Widget targets are displayed when you start dragging a widget, but you can use tabs or a title bar of another widget.
- **Float a widget** - drag and drop a widget anywhere on the page. You can drag a widget tab or a widget title bar.
- **Popout a widget** - click on the popout icon in the widget title bar. Close the opened browser window to return the widget to the original widget container.
- **Resize a floating widget** - drag one of four edges or corners of a floating widget.
- **Move a floating widget** - drag the widget by the title bar.
- **Send back a floating widget** - click on the send back icon in the widget title bar.
- **Resize a stage panel** - drag the resize handle of a stage panel.
- **Pin/unpin a stage panel** - click on the pin/unpin icon in the title bar of a first stage panel section.
- **Collapse/uncollapse a stage panel** - click on the resize handle of a stage panel or use the drag interaction.
- **Resize a stage panel section** - drag the resize handle between the stage panel sections.

## Toolbars

A standard frontstage is divided into two sections dedicated for content manipulation and view navigation that overlay the content control. By default [ContentToolWidgetComposer]($appui-react) and [ViewToolWidgetComposer]($appui-react) are used to display up to four toolbars with a specific purpose as defined in [ToolbarUsage]($appui-react) and [ToolbarOrientation]($appui-react). Alternatively you can provide custom components for `contentManipulation` and `viewNavigation` when [Creating a Frontstage](#create-a-frontstage).

You can use [UiItemsProvider]($appui-react) to provide additional items to the toolbars. For more information, see [Provide Toolbar Items](./provide-ui-items.md#provide-toolbar-items).

To create a custom toolbar you can use a [ToolbarComposer]($appui-react) component.

## Widgets

A [widget](./configure-frontstage#widgets)is an interactive UI element for a custom content of an application that allows the user to view and/or modify data relevant to their current context. The content of the widget is just a React component, but additional meta-data such as label or icon can be provided to customize or initialize the widget.

Widget container to which the widget is assigned can have multiple states.

**Docked** - when a widget is docked to one of stage panel sections on the side of the page.

**Floating** - when a widget is displayed in a dialog like component of the page.

**Popout** - when a widget is displayed in a separate browser window.

## Tool Settings

**Tool settings** is a dedicated area in the user interface that contains settings for the active tool. In a standard layout it is displayed as a bar at the top of the application, but it can be undocked as a regular widget as well.

To display the tool settings you need to supply property information from the Tool.

```tsx
[[include:AppUI.ToolSettings.SupplyProperties]]
```

## Status Bar

**Status bar** is a dedicated area in the user interface that displays multiple status fields with information about the current state of the application. In a standard layout [StatusBarComposer]($appui-react) is used to display a status bar at the bottom of the application.

You can use [UiItemsProvider]($appui-react) to provide additional items to the status bar. For more information, see [Provide StatusBar Items](./provide-ui-items.md#provide-statusbar-items).

## Backstage

**Backstage** is a main navigation menu of the application. You can provide menu items to open frontstages, overlays or launch custom tasks. In the standard layout [BackstageComposer]($appui-react) is used to display a menu along the left edge of the application.

You can use [UiItemsProvider]($appui-react) to provide additional items to the status bar. For more information, see [Provide Backstage Items](./provide-ui-items.md#provide-backstage-items).

To set-up the backstage define the `appBackstage` property of [ConfigurableUiContent]($appui-react).

```tsx
[[include:AppUI.Backstage.SetUp]]
```
