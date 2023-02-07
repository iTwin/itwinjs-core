# Frontstages

A **Frontstage** is a full-screen configuration designed to enable the user to accomplish a task. There are three types of frontstages:

|Type|Description
|-----|-----
|**Primary** | may use all zones and stage panels and the Tool Widget contains the App button that opens the App menu
|**Nested** | is accessed from a primary frontstage. It may use all zones and panels, but instead of the App button, the Tool Widget contains a Back button to return to the primary frontstage.
|**Modal** | is accessed from another frontstage or the Backstage. It may contain any content along with a Back button. It does not use zones or stage panels. It is useful for application settings and data management user interfaces.

## Example Frontstage definition for displaying a viewport

### Implementing ContentGroupProvider

[ContentGroupProvider]($appui-react) describes the contents that the Frontstage will contain.

```tsx
[[include:Example_Viewport_Frontstage_Group_Provider_1]]
[[include:Example_Viewport_Frontstage_Group_Provider_2]]
```

### Registering Frontstage

Stage contents are then wrapped by a [StandardFrontstageProvider]($appui-react) class and registered by [ConfigurableUiManager]($appui-react) for further use.

```tsx
[[include:Example_Register_Viewport_Frontstage]]
```

Other Ui items (like toolbars) contained within the Frontstage should be registered separately using [UiItemsManager]($appui-abstract).

### Usage

The Stage usage prop is a way to designate the type of tasks that will be performed in the stage and can be used by UiItemsProviders to
determine if it should supply items such as tool button, widgets, or status bar items, to populate the stage. See [StageUsage]($appui-abstract) for a default set of usages.

## Example FrontstageProvider implementation for displaying custom content

### Implementing FrontstageProvider

```tsx
[[include:Example_Custom_Frontstage_Provider_1]]
[[include:Example_Custom_Frontstage_Provider_2]]
```

### Implementing ContentControl

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
