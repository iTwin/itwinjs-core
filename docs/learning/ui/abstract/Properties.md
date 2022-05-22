# Properties

## Property Description

A [PropertyDescription]($appui-abstract:Properties) describes the metadata associated with a property that can be used to display and edit it in the UI.

Included in the metadata are the type and format of the property's value, its editor type and parameters.

## Property Editor Params

Property Editor Params are used to specify the type of editor shown in the UI for the property. The [BasePropertyEditorParams]($appui-abstract:Properties) handles strings:

```ts
// ------------- text based edit field ---------------
private static _cityName = "city";
private static _getCityDescription = (): PropertyDescription => {
  return {
    name: SampleTool._cityName,
    displayLabel: SampleTool.i18n.translate("sampleNameSpace:tools.SampleTool.Prompts.City"),
    typename: "string",
  };
}
```

The size of the input field can be controlled with [InputEditorSizeParams]($appui-abstract:Properties):

```ts
// ------------- text based edit field ---------------
private static _stateName = "state";
private static _getStateDescription = (): PropertyDescription => {
  return {
    name: SampleTool._stateName,
    displayLabel: SampleTool.i18n.translate("sampleNameSpace:tools.SampleTool.Prompts.State"),
    typename: "string",
    editor: {
      params: [{
        type: PropertyEditorParamTypes.InputEditorSize,
        size: 4,
        /* maxLength: 60,*/
      } as InputEditorSizeParams,
      ],
    },
  };
}
```

For any editor type, the label can be suppressed using [SuppressLabelEditorParams]($appui-abstract:Properties).

Numeric values can be formatted with custom formatters using [CustomFormattedNumberParams]($appui-abstract:Properties).

Enums can be edited as a selection list:

```ts
// ------------- Enum based picklist ---------------
private static enumAsPicklistMessage(str: string) { return SampleTool.i18n.translate("sampleNameSpace:tools.SampleTool.Options." + str); }
private static _optionsName = "enumAsPicklist";
private static _getEnumAsPicklistDescription = (): PropertyDescription => {
  return {
    name: SampleTool._optionsName,
    displayLabel: SampleTool.i18n.translate("sampleNameSpace:tools.SampleTool.Prompts.Options"),
    typename: "enum",
    enum: {
      choices: [
        { label: SampleTool.enumAsPicklistMessage("Red"), value: ToolOptions.Red },
        { label: SampleTool.enumAsPicklistMessage("White"), value: ToolOptions.White },
        { label: SampleTool.enumAsPicklistMessage("Blue"), value: ToolOptions.Blue },
        { label: SampleTool.enumAsPicklistMessage("Yellow"), value: ToolOptions.Yellow },
      ],
    },
  };
}
```

or using as button group with [ButtonGroupEditorParams]($appui-abstract:Properties):

```ts
private static _methodsName = "selectionMethods";
/* The property descriptions used to generate ToolSettings UI. */
private static _getMethodsDescription(): PropertyDescription {
  return {
    name: SelectionTool._methodsName,
    displayLabel: "",
    typename: "enum",
    editor: {
      name: "enum-buttongroup",
      params: [{
        type: PropertyEditorParamTypes.ButtonGroupData,
        buttons: [
          { iconSpec: "icon-select-single" },
          { iconSpec: "icon-select-line" },
          { iconSpec: "icon-select-box" },
        ],
      } as ButtonGroupEditorParams, {
        type: PropertyEditorParamTypes.SuppressEditorLabel,
        suppressLabelPlaceholder: true,
      } as SuppressLabelEditorParams,
      ],
    },
    enum: {
      choices: [
        { label: SelectionTool.methodsMessage("Pick"), value: SelectionMethod.Pick },
        { label: SelectionTool.methodsMessage("Line"), value: SelectionMethod.Line },
        { label: SelectionTool.methodsMessage("Box"), value: SelectionMethod.Box },
      ],
    },
  };
}
```

Colors may be edited in a color picker by specifying the available colors as an enum and using the [ColorEditorParams]($appui-abstract:Properties):

```ts
private static _colorName = "color";
private static _getColorDescription = (): PropertyDescription => {
  return {
    name: SampleTool._colorName,
    displayLabel: SampleTool.i18n.translate("sampleNameSpace:tools.SampleTool.Prompts.Color"),
    typename: "number",
    editor: {
      name: "color-picker",
      params: [{
        type: PropertyEditorParamTypes.ColorData,
        colorValues: [
          ColorByName.blue as number,
          ColorByName.red as number,
          ColorByName.green as number,
          ColorByName.yellow as number,
          ColorByName.black as number,
          ColorByName.gray as number,
          ColorByName.purple as number,
          ColorByName.pink as number,
        ],
        numColumns: 2,
      } as ColorEditorParams,
      ],
    },
  };
}
```

## Property Record

A [PropertyRecord]($appui-abstract:Properties) contains instance data about a Property. [EditorContainer]($components-react) can use the data from a PropertyRecord to create a PropertyEditor React component that converts the instance data using a [TypeConverter]($components-react:TypeConverters).

## API Reference

[Properties]($appui-abstract:Properties)
