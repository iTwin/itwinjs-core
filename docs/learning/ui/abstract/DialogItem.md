# DialogItem

The [DialogItem]($ui-abstract:Dialog) interface is used to specify user interface components in a technology-agnostic way. The [UiLayoutDataProvider]($ui-abstract:Dialog) uses DialogItem specifications to create React components in our App UI system.

For example, this code:

```ts
// ------------- boolean based toggle button ---------------
private static _lockToggleName = "lockToggle";
private static _getLockToggleDescription = (): PropertyDescription => {
  return {
    name: SampleTool._lockToggleName,
    displayLabel: SampleTool.i18n.translate("sampleNameSpace:tools.SampleTool.Prompts.Lock"),
    typename: "boolean",
    editor: { name: "toggle" },
  };
}

private _lockValue: DialogItemValue = { value: true };

public get lock(): boolean {
  return this._lockValue.value as boolean;
}

public set lock(option: boolean) {
  this._lockValue.value = option;
}

{ value: this._lockValue, property: SampleTool._getLockToggleDescription(), editorPosition: { rowPriority: 5, columnIndex: 2 } }
```

Results in this React component:

![sample lock toggle](./images/LockToggle.png "Sample Lock Toggle")

The [UiLayoutDataProvider]($ui-abstract:Dialog) has limitations. It only supports a subset of primitive data types, as defined in [DialogItemValue]($ui-abstract:Dialog) and the components are laid out in a simple grid format. A component's position in the grid is specified by the [EditorPosition]($ui-abstract:Dialog) interface with the rowPriority and columnIndex allowing components to be grouped on rows together.When components overflow the Tool Settings bar in the App UI interface, rows are wrapped together so that a row is never broken apart upon overflow wrapping.

The final member of DialogItem is an optional lockProperty. If set, this automatically generates a check-box to enable or disable the component on the dialog. This is useful when the component is part of the Tool Settings for an app's interactive tool.
For example, this DialogItem

```ts
const lengthLock = { value: this._useLengthValue, property: SampleTool._getUseLengthDescription()}
{ value: this._lengthValue, property: this._lengthDescription, editorPosition: { rowPriority: 20, columnIndex: 2 }, isDisabled: false, lockProperty: lengthLock }
```

Will result in this group of React components:

![sample lock toggle](./images/LengthLock.png "Length Lock")

## API Reference

- [DialogItem]($ui-abstract:Dialog)
