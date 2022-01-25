# Tool Settings

'Tool Settings' refers to the App UI widget containing settings for the active tool. By default, the Tool Settings display in a bar at the top of the application window, but the widget can also be a floating dialog or docked into the left or right panel.

Tools have two options for populating the Tool Settings widget. The tool can register their own React-based ToolUiProvider to display the UI components for its settings. An alternate approach is for the tool to publish information about the properties it uses for settings and allow the 'DefaultToolSettings' provider to generate the necessary UI components.

## Default ToolSettings Provider

Any Tool derived from Interactive tool can implement the method `supplyToolSettingsProperties` to supply an array of `DialogItem` objects that define the property definitions and its position with a grid layout. The DefaultToolSettings provider will then automatically generate a type editor for the type of data required and show that editor in the row and column specified.  Unless suppressed via an `EditorParams`, a label will be generated using the `displayLabel` for the property and shown in the column to the left of the editor.

### Example of Tool Defining properties to be shown in Tool Setting Zone

```tsx
export class SampleToolWithSetting extends PrimitiveTool {
  public static toolId = "SampleToolWithSetting";

  // --- some code removed for brevity ---

  // is set the tool uses specified length value, if not tool calculates value an reports it back to UI via syncLengthInUi
  private _useLengthProperty: DialogProperty<boolean> | undefined;
  public get useLengthProperty() {
    if (!this._useLengthProperty)
      this._useLengthProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildLockPropertyDescription("useLength"), false);
    return this._useLengthProperty;
  }
  public get useLength(): boolean { return this.useLengthProperty.value; }
  public set useLength(value: boolean) { this.useLengthProperty.value = value; }

  // length value to be used by tool if useLength is true
  private _lengthProperty: DialogProperty<number> | undefined;
  public get lengthProperty() {
    if (!this._lengthProperty)
      this._lengthProperty = new DialogProperty<number>(new LengthDescription("length", "Length")),
        0.1, undefined, !this.useLength);
    return this._lengthProperty;
  }
  public get length(): number { return this.lengthProperty.value; }
  public set length(value: number) { this.lengthProperty.value = value; }

  // Called by UI code to get list of properties to display in Tool Setting zone
  public supplyToolSettingsProperties(): DialogItem[] | undefined {
    const toolSettings = new Array<DialogItem>();
      this._lengthProperty.isDisabled = !this.useLength; // enable length field when checkbox is checked
      const useLengthLock = this._useLengthProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 });
      toolSettings.push(this._lengthProperty.toDialogItem({ rowPriority: 2, columnIndex: 1 }, useLengthLock));
    }
    return toolSettings;
  }

  // Respond to user changes in the tool settings UI components
  public async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    if (updatedValue.propertyName === this.useLengthProperty.name) {
      this.useLength = updatedValue.value.value as boolean;
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, this.useLengthProperty.item);
      this.syncLengthState();
    } else if (updatedValue.propertyName === this.lengthProperty.name) {
      if (!updatedValue.value.value) {
        this.syncLengthState(); // force UI to redisplay last valid value
        return false;
      }
      this.length = updatedValue.value.value as number;
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, this.lengthProperty.item);
      return true;
    }
    return false;
  }

  // Refresh the UI with the latest values from the tool
  private syncLengthInUi(): void {
    this._lengthProperty.displayValue = (this.lengthProperty.description as LengthDescription).format(this.length);
    this._lengthProperty.isDisabled = !this.useLength;
    this.syncToolSettingsProperties([this.lengthProperty.syncItem]);
  }
}
```

### Informing Tool of property changes

When a user interacts with any of the generated type editors in the Tool Settings Widget, the changes are sent back to the active tool by calling its `applyToolSettingPropertyChange` method, passing in the name of the changed property and the property's new value.

### Informing the UI of property changes made by the Tool

If the 'Active' Tool updates a property that is being displayed by a type editor in the Tool Settings Widget, it can call its `syncToolSettingsProperties` method and supply an array of `DialogPropertySyncItem` objects to specify new values to display in the UI. This is commonly done when the Tool is in a dynamics loop and recalculating values to display in the UI.

### Classes and Interfaces used the the Default Tool Settings Provider

The following classes defined within the appui-abstract package are used by the Default Tool Settings Provider.

- [DialogItem]($appui-abstract)
- [PropertyRecord]($appui-abstract)
- [PropertyDescription]($appui-abstract)
- [DialogItemValue]($appui-abstract)
- [DialogPropertySyncItem]($appui-abstract)
- [EditorPosition]($appui-abstract)
- [PropertyEditorParamTypes]($appui-abstract)
- [PropertyValue]($appui-abstract)

## API Reference

- [ToolSettings]($appui-react:ToolSettings)
