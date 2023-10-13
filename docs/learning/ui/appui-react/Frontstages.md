# Frontstages

A **Frontstage** is a full-screen configuration designed to enable the user to accomplish a task. There are three types of frontstages:

| Type        | Description                                                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary** | may use all zones and stage panels and the Tool Widget contains the App button that opens the App menu                                                                                                                       |
| **Nested**  | is accessed from a primary frontstage. It may use all zones and panels, but instead of the App button, the Tool Widget contains a Back button to return to the primary frontstage.                                           |
| **Modal**   | is accessed from another frontstage or the Backstage. It may contain any content along with a Back button. It does not use zones or stage panels. It is useful for application settings and data management user interfaces. |

Below is an example frontstage that shows the different areas/zones.

![FrontstageUi2](./images/FrontstageUi2.png "App UI Frontstage design")

## Example Frontstage definition for displaying a viewport

### Implementing ContentGroupProvider

[ContentGroupProvider]($appui-react) describes the contents that the frontstage will contain.

```tsx
[[include:Example_Viewport_Frontstage_Group_Provider]]
```

### Registering frontstage

Stage contents are then provided to a [StandardFrontstageProvider]($appui-react) which is registered by [UiFramework.frontstages]($appui-react) for further use.

```tsx
[[include:Example_Register_Viewport_Frontstage]]
```

Other UI items (like toolbars) contained within the frontstage should be registered via [UiItemsManager]($appui-abstract).

### Usage

The Stage usage prop is a way to designate the type of tasks that will be performed in the stage and can be used by UiItemsProviders to
determine if it should supply items such as tool button, widgets, or status bar items, to populate the stage. See [StageUsage]($appui-react) for a default set of usages.

## Example FrontstageProvider implementation for displaying custom content

### Implementing FrontstageProvider

[FrontstageProvider]($appui-react) contains all the information about what is displayed on the frontstage. This includes the main content view as well as various side panels and tools passed as [FrontstageConfig]($appui-react) properties.

```tsx
[[include:Example_Custom_Frontstage_Provider]]
```

### Implementing ContentControl

[ContentControl]($appui-react) describes the main content view of the frontstage.

```tsx
[[include:Example_Custom_Content_Control]]
```

## Related Learning Topics

- [Content Views and Layouts](./ContentViews.md)
- [Widgets](./Widgets.md)
- [Status Bar and Fields](./StatusBar.md)
- [Tool Settings](./ToolSettings.md)

## API Reference

- [Frontstage]($appui-react:Frontstage)
