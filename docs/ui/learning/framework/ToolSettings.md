# Tool Settings

'Tool Settings' refers to the UI widget that is shown in top center zone of the application window and the UI components displayed there. These UI component allow users to control settings/properties used by the "active" tool. Tools have two options for populating the Tool Settings widget. The tool can register their own React-based ToolUiProvider to display the UI components for its settings. An alternate approach is for the tool to publish information about the properties it uses for settings and allow the 'DefaultToolSettings' provider to generate the necessary UI components.

## Default ToolSettings Provider

Any Tool derived from Interactive tool can implement the method supplyToolSettingsProperties to supply an array of 'ToolSettingsPropertyRecord' objects that define the  property definitions and its position with a grid layout. The default ToolSettings provider will then automatically generate a type editor for the type of data required and show that editor in the row and column specified.  Unless suppressed via an EditorParams a label will be generated using the displayLabel for the property and shown in the column to the left of the editor.  The editor can occupy multiple columns in the layout grid by specifying a columnSpan value in the properties editor position parameters. The default columnSpan value is 1.

### Informing Tool of property changes

When a user interacts with any of the generated type editors, in the Tool Settings Widget, the changes are sent back to the active tool by calling its applyToolSettingPropertyChange method and passing it the name of the property that changed and the new value of the property.

### Informing the UI of property changes made by the Tool

If the 'Active' Tool updates a property that is being displayed by a type editor in the Tool Settings Widget, it can call its syncToolSettingsProperties method and supply an array of ToolSettingsPropertySyncItem objects to specify new values to display in the UI. This is commonly done when the Tool is in a dynamics loop and recalculating values to display in the UI.

### Classes and Interfaces used the the Default Tool Settings Provider

The following classes defined within the imodeljs-frontend package are used by the Default Tool Settings Provider.

* ToolSettingsPropertyRecord
* PropertyRecord
* PropertyDescription
* ToolSettingsValue
* ToolSettingsPropertySyncItem
* EditorPosition
* PropertyEditorParamTypes
* PropertyValue