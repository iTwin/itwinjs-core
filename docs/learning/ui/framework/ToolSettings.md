# Tool Settings

'Tool Settings' refers to the UI widget that is shown in top center zone of the application window and the UI components displayed there. When using the iTwin.js 2.0 UI, a.k.a. "App UI", the tool settings display in a bar across the top of the window.
These UI components allow users to control settings/properties used by the "active" tool. Tools have two options for populating the Tool Settings widget. The tool can register their own React-based ToolUiProvider to display the UI components for its settings. An alternate approach is for the tool to publish information about the properties it uses for settings and allow the 'DefaultToolSettings' provider to generate the necessary UI components.

## Default ToolSettings Provider

Any Tool derived from Interactive tool can implement the method `supplyToolSettingsProperties` to supply an array of `DialogItem` objects that define the  property definitions and its position with a grid layout. The DefaultToolSettings provider will then automatically generate a type editor for the type of data required and show that editor in the row and column specified.  Unless suppressed via an `EditorParams`, a label will be generated using the `displayLabel` for the property and shown in the column to the left of the editor. .

### Informing Tool of property changes

When a user interacts with any of the generated type editors, in the Tool Settings Widget, the changes are sent back to the active tool by calling its `applyToolSettingPropertyChange` method and passing it the name of the property that changed and the new value of the property.

### Informing the UI of property changes made by the Tool

If the 'Active' Tool updates a property that is being displayed by a type editor in the Tool Settings Widget, it can call its `syncToolSettingsProperties` method and supply an array of `DialogPropertySyncItem` objects to specify new values to display in the UI. This is commonly done when the Tool is in a dynamics loop and recalculating values to display in the UI.

### Classes and Interfaces used the the Default Tool Settings Provider

The following classes defined within the ui-abstract package are used by the Default Tool Settings Provider.

- [DialogItem]($ui-abstract)
- [PropertyRecord]($ui-abstract)
- [PropertyDescription]($ui-abstract)
- [DialogItemValue]($ui-abstract)
- [DialogPropertySyncItem]($ui-abstract)
- [EditorPosition]($ui-abstract)
- [PropertyEditorParamTypes]($ui-abstract)
- [PropertyValue]($ui-abstract)

## API Reference

- [ToolSettings]($ui-framework:ToolSettings)
