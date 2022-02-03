/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type {
  ButtonGroupEditorParams, DialogItem, DialogItemValue, DialogPropertySyncItem, PropertyDescription} from "@itwin/appui-abstract";
import { PropertyEditorParamTypes,
} from "@itwin/appui-abstract";

/** @internal */
export enum SelectOptions {
  Method_Pick,
  Method_Line,
  Method_Box,
  Method_View,
  Mode_Add,
  Mode_Remove,
}

const selectionOptionDescription: PropertyDescription = {
  name: "selectionOptions",
  displayLabel: "Mode",
  typename: "enum",
  editor: {
    name: "enum-buttongroup",
    params: [{
      type: PropertyEditorParamTypes.ButtonGroupData,
      buttons: [
        { iconSpec: "select-single" },
        { iconSpec: "select-line" },
        { iconSpec: "select-box" },
        { iconSpec: "view-layouts" },
        { iconSpec: "select-plus" },
        { iconSpec: "select-minus" },
      ],
    } as ButtonGroupEditorParams],
  },
  enum: {
    choices: [
      { label: "Pick", value: SelectOptions.Method_Pick },
      { label: "Line", value: SelectOptions.Method_Line },
      { label: "Box", value: SelectOptions.Method_Box },
      { label: "View", value: SelectOptions.Method_View },
      { label: "Add", value: SelectOptions.Mode_Add },
      { label: "Remove", value: SelectOptions.Mode_Remove },
    ],
  },
};

// ==========================================================================================================================================================
//   Mock SelectTool
// ==========================================================================================================================================================
class MockSelectTool {
  private _selectionOptionValue: DialogItemValue = { value: SelectOptions.Method_Pick };
  private _changeFunc?: (propertyValues: DialogPropertySyncItem[]) => void;

  public get selectionOption(): SelectOptions {
    return this._selectionOptionValue.value as SelectOptions;
  }

  public set selectionOption(option: SelectOptions) {
    this._selectionOptionValue.value = option;
    const syncItem: DialogPropertySyncItem = { value: this._selectionOptionValue, propertyName: selectionOptionDescription.name };
    this.syncToolSettingsProperties([syncItem]);
  }

  /** Used to supply DefaultToolSettingProvider with a list of properties to use to generate ToolSettings.  If undefined then no ToolSettings will be displayed */
  public supplyToolSettingsProperties(): DialogItem[] | undefined {
    const toolSettings = new Array<DialogItem>();
    toolSettings.push({ value: this._selectionOptionValue, property: selectionOptionDescription, editorPosition: { rowPriority: 0, columnIndex: 0 } });
    return toolSettings;
  }

  /** Used to send changes from UI back to Tool */
  public applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): boolean {
    if (updatedValue.propertyName === selectionOptionDescription.name) {
      this._selectionOptionValue = updatedValue.value;
      if (this._selectionOptionValue) {
        // value was updated
      } else {
        // value was not updated
      }
    }
    // return true is change is valid
    return true;
  }

  /** Used by DefaultToolSettingProvider to register to receive changes from tool .... like updating length or angle  */
  public set toolSettingPropertyChangeHandler(changeFunc: (propertyValues: DialogPropertySyncItem[]) => void) {
    this._changeFunc = changeFunc;
  }

  /** Called by tool to update the UI with changed made by tool */
  public syncToolSettingsProperties(propertyValues: DialogPropertySyncItem[]) {
    if (this._changeFunc)
      this._changeFunc(propertyValues);
  }
}

// ==========================================================================================================================================================

const useLengthDescription: PropertyDescription = {
  name: "use-length",
  displayLabel: "",
  typename: "boolean",
  editor: { name: "checkbox" },
};

const lengthDescription: PropertyDescription = {
  name: "length",
  displayLabel: "Length",
  typename: "double",
  quantityType: "Length",  // QuantityType or KOQ (schema:koq) [maybe make string | QuantityType]
  editor: { name: "koq-double" },
};

const useAngleDescription: PropertyDescription = {
  name: "use-angle",
  displayLabel: "",
  typename: "boolean",
  editor: { name: "checkbox" },
};

const angleDescription: PropertyDescription = {
  name: "angle",
  displayLabel: "Angle",
  typename: "double",
  quantityType: "angle",  // QuantityType or KOQ fullname (schema:koq)
  editor: { name: "koq-double" },
};

// ==========================================================================================================================================================
//   Mock PlaceLineTool
// ==========================================================================================================================================================
class MockPlaceLineTool {
  private _useLengthValue: DialogItemValue = { value: false };
  private _lengthValue: DialogItemValue = { value: 1.0 };
  private _useAngleValue: DialogItemValue = { value: false };
  private _angleValue: DialogItemValue = { value: 0.0 };

  private _changeFunc?: (propertyValues: DialogPropertySyncItem[]) => void;

  public get useLength(): boolean {
    return this._useLengthValue.value as boolean;
  }

  public get length(): number {
    return this._lengthValue.value as number;
  }

  public set length(length: number) {
    this._lengthValue = { value: length };
    this.syncToolSettingsProperties([{ value: this._lengthValue, propertyName: lengthDescription.name }]);
  }

  public get useAngle(): boolean {
    return this._useAngleValue.value as boolean;
  }

  public get angle(): number {
    return this._angleValue.value as number;
  }

  public set angle(angle: number) {
    this._angleValue = { value: angle };
    this.syncToolSettingsProperties([{ value: this._angleValue, propertyName: angleDescription.name }]);
  }

  /** Used to supply DefaultToolSettingProvider with a list of properties to use to generate ToolSettings.  If undefined then no ToolSettings will be displayed */
  public supplyToolSettingsProperties(): DialogItem[] | undefined {
    const toolSettings = new Array<DialogItem>();
    toolSettings.push({ value: this._useLengthValue, property: useLengthDescription, editorPosition: { rowPriority: 0, columnIndex: 0 } });
    toolSettings.push({ value: this._lengthValue, property: lengthDescription, editorPosition: { rowPriority: 0, columnIndex: 1 } });
    toolSettings.push({ value: this._useAngleValue, property: useAngleDescription, editorPosition: { rowPriority: 1, columnIndex: 0 } });
    toolSettings.push({ value: this._angleValue, property: angleDescription, editorPosition: { rowPriority: 1, columnIndex: 1 } });
    return toolSettings;
  }

  /** Used to send changes from UI back to Tool */
  // verify dialog item update
  public applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): boolean {
    switch (updatedValue.propertyName) {
      case useLengthDescription.name:
        this._useLengthValue = updatedValue.value;
        break;
      case lengthDescription.name:
        this._lengthValue = updatedValue.value;
        break;
      case useAngleDescription.name:
        this._useAngleValue = updatedValue.value;
        break;
      case angleDescription.name:
        this._angleValue = updatedValue.value;
        break;
      default:
        return false;
    }
    // return true is change is valid
    return true;
  }

  /** Used by DefaultToolSettingProvider to register to receive changes from tool .... like updating length or angle  */
  public set toolSettingPropertyChangeHandler(changeFunc: (propertyValues: DialogPropertySyncItem[]) => void) {
    this._changeFunc = changeFunc;
  }

  /** Called by tool to update the UI with changed made by tool */
  public syncToolSettingsProperties(propertyValues: DialogPropertySyncItem[]) {
    if (this._changeFunc)
      this._changeFunc(propertyValues);
  }
}

// ==========================================================================================================================================================

describe("Default ToolSettings", () => {

  it("mock SelectTool", () => {

    const mockSelectTool = new MockSelectTool();
    expect(mockSelectTool.selectionOption).to.be.equal(SelectOptions.Method_Pick);
    const selectToolSettings = mockSelectTool.supplyToolSettingsProperties();
    expect(selectToolSettings).to.not.be.undefined;
    if (selectToolSettings) {
      expect(selectToolSettings.length).to.be.equal(1);

      // update local value with tools latest value
      const changeHandler = (syncItems: DialogPropertySyncItem[]): void => {
        const syncValue = syncItems[0].value;
        selectToolSettings[0] = { value: syncValue, property: selectToolSettings[0].property, editorPosition: selectToolSettings[0].editorPosition, isDisabled: selectToolSettings[0].isDisabled, lockProperty: selectToolSettings[0].lockProperty };
      };

      mockSelectTool.toolSettingPropertyChangeHandler = changeHandler;

      // simulate UI changing property value
      const updatedSelectPropertyValue: DialogItemValue = { value: SelectOptions.Method_Box };
      const syncItem: DialogPropertySyncItem = { value: updatedSelectPropertyValue, propertyName: selectToolSettings[0].property.name };
      mockSelectTool.applyToolSettingPropertyChange(syncItem);

      expect(mockSelectTool.selectionOption).to.be.equal(SelectOptions.Method_Box);

      // simulate tool changing property value which should trigger change handler
      mockSelectTool.selectionOption = SelectOptions.Mode_Remove;

      expect(mockSelectTool.selectionOption).to.be.equal(SelectOptions.Mode_Remove);
      expect(selectToolSettings[0].value.value).to.be.equal(SelectOptions.Mode_Remove);
    }
  });

  it("mock PlaceLineTool", () => {
    const mockPlaceLineTool = new MockPlaceLineTool();
    expect(mockPlaceLineTool.angle).to.be.equal(0.0);
    expect(mockPlaceLineTool.useAngle).to.be.equal(false);
    expect(mockPlaceLineTool.length).to.be.equal(1.0);
    expect(mockPlaceLineTool.useLength).to.be.equal(false);
    const lineToolSettings = mockPlaceLineTool.supplyToolSettingsProperties();
    expect(lineToolSettings).to.not.be.undefined;
    if (lineToolSettings) {
      expect(lineToolSettings.length).to.be.equal(4);

      // update local value with tools latest value
      const changeHandler = (syncItems: DialogPropertySyncItem[]): void => {
        syncItems.forEach((item) => {
          switch (item.propertyName) {
            case useLengthDescription.name:
              lineToolSettings[0] = { value: item.value, property: lineToolSettings[0].property, editorPosition: lineToolSettings[0].editorPosition, isDisabled: lineToolSettings[0].isDisabled, lockProperty: lineToolSettings[0].lockProperty };
              break;
            case lengthDescription.name:
              lineToolSettings[1] = { value: item.value, property: lineToolSettings[1].property, editorPosition: lineToolSettings[1].editorPosition, isDisabled: lineToolSettings[1].isDisabled, lockProperty: lineToolSettings[1].lockProperty };
              break;
            case useAngleDescription.name:
              lineToolSettings[2] = { value: item.value, property: lineToolSettings[2].property, editorPosition: lineToolSettings[2].editorPosition, isDisabled: lineToolSettings[2].isDisabled, lockProperty: lineToolSettings[2].lockProperty };
              break;
            case angleDescription.name:
              lineToolSettings[3] = { value: item.value, property: lineToolSettings[3].property, editorPosition: lineToolSettings[3].editorPosition, isDisabled: lineToolSettings[3].isDisabled, lockProperty: lineToolSettings[3].lockProperty };
              break;
          }
        });
      };

      mockPlaceLineTool.toolSettingPropertyChangeHandler = changeHandler;

      // simulate changing useLengthValue value in UI
      const updatedUseLengthValue = { value: true };
      mockPlaceLineTool.applyToolSettingPropertyChange({ value: updatedUseLengthValue, propertyName: lineToolSettings[0].property.name });
      expect(mockPlaceLineTool.useLength).to.be.equal(true);

      // simulate changing lengthValue value in UI
      const updatedLengthValue = { value: 22.22 };
      mockPlaceLineTool.applyToolSettingPropertyChange({ value: updatedLengthValue, propertyName: lineToolSettings[1].property.name });
      expect(mockPlaceLineTool.length).to.be.equal(22.22);

      // simulate changing useAngleValue value in UI
      const updatedUseAngleValue = { value: true };
      mockPlaceLineTool.applyToolSettingPropertyChange({ value: updatedUseAngleValue, propertyName: lineToolSettings[2].property.name });
      expect(mockPlaceLineTool.useAngle).to.be.equal(true);

      // simulate changing angleValue value in UI
      const updatedAngleValue = { value: 3.14 };
      mockPlaceLineTool.applyToolSettingPropertyChange({ value: updatedAngleValue, propertyName: lineToolSettings[3].property.name });
      expect(mockPlaceLineTool.angle).to.be.equal(3.14);

      // simulate tool changing property value which should trigger change handler
      mockPlaceLineTool.length = 16.67;
      expect(mockPlaceLineTool.length).to.be.equal(16.67);
      expect(lineToolSettings[1].value.value).to.be.equal(16.67);

      mockPlaceLineTool.angle = 1.57;
      expect(mockPlaceLineTool.angle).to.be.equal(1.57);
      expect(lineToolSettings[3].value.value).to.be.equal(1.57);
    }
  });

});
