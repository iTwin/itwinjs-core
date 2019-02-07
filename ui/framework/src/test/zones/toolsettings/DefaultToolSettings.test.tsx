/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// import * as React from "react";
// import { mount, shallow } from "enzyme";
import { expect } from "chai";
import {
  QuantityType, PropertyDescription, PrimitiveValue, ToolSettingsValue, PropertyEditorParamTypes,
  ToolSettingsPropertySyncItem, ToolSettingsPropertyRecord, TsHorizontalAlignment,
} from "@bentley/imodeljs-frontend";

// import TestUtils from "../../TestUtils";

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
    params: [
      {
        type: PropertyEditorParamTypes.JSON,
        json: {
          buttonGroupData: [
            { icon: "select-single" },
            { icon: "select-line" },
            { icon: "select-box" },
            { icon: "view-layouts" },
            { icon: "select-plus" },
            { icon: "select-minus", syncUiEvents: ["UISyncMsgId.SelectionChanged"], enableExpression: "DgnClientFx.isSelectionActive" },
          ],
        },
      },
    ],
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
  private _selectionOptionValue: ToolSettingsValue = new ToolSettingsValue(SelectOptions.Method_Pick);
  private _changeFunc?: (propertyValues: ToolSettingsPropertySyncItem[]) => void;

  public get selectionOption(): SelectOptions {
    return this._selectionOptionValue.value as SelectOptions;
  }

  public set selectionOption(option: SelectOptions) {
    this._selectionOptionValue.value = option;
    const syncItem: ToolSettingsPropertySyncItem = { value: this._selectionOptionValue, propertyName: selectionOptionDescription.name };
    this.syncToolSettingsProperties([syncItem]);
  }

  /** Used to supply DefaultToolSettingProvider with a list of properties to use to generate ToolSettings.  If undefined then no ToolSettings will be displayed */
  public supplyToolSettingsProperties(): ToolSettingsPropertyRecord[] | undefined {
    const toolSettings = new Array<ToolSettingsPropertyRecord>();
    toolSettings.push(new ToolSettingsPropertyRecord(this._selectionOptionValue.clone() as PrimitiveValue, selectionOptionDescription, { rowPriority: 0, columnPriority: 0, horizontalAlignment: TsHorizontalAlignment.Center }));
    return toolSettings;
  }

  /** Used to send changes from UI back to Tool */
  public applyToolSettingPropertyChange(updatedValue: ToolSettingsPropertySyncItem): boolean {
    if (updatedValue.propertyName === selectionOptionDescription.name) {
      if (this._selectionOptionValue.update(updatedValue.value)) {
        // value was updated
      } else {
        // value was not updated
      }
    }
    // return true is change is valid
    return true;
  }

  /** Used by DefaultToolSettingProvider to register to receive changes from tool .... like updating length or angle  */
  public set toolSettingPropertyChangeHandler(changeFunc: (propertyValues: ToolSettingsPropertySyncItem[]) => void) {
    this._changeFunc = changeFunc;
  }

  /** Called by tool to update the UI with changed made by tool */
  public syncToolSettingsProperties(propertyValues: ToolSettingsPropertySyncItem[]) {
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
  quantityType: QuantityType.Length,  // QuantityType or KOQ (schema:koq) [maybe make string | QuantityType]
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
  quantityType: QuantityType.LatLong,  // QuantityType or KOQ fullname (schema:koq)
  editor: { name: "koq-double" },
};

// ==========================================================================================================================================================
//   Mock PlaceLineTool
// ==========================================================================================================================================================
class MockPlaceLineTool {
  private _useLengthValue: ToolSettingsValue = new ToolSettingsValue(false);
  private _lengthValue: ToolSettingsValue = new ToolSettingsValue(1.0);
  private _useAngleValue: ToolSettingsValue = new ToolSettingsValue(false);
  private _angleValue: ToolSettingsValue = new ToolSettingsValue(0.0);

  private _changeFunc?: (propertyValues: ToolSettingsPropertySyncItem[]) => void;

  public get useLength(): boolean {
    return this._useLengthValue.value as boolean;
  }

  public get length(): number {
    return this._lengthValue.value as number;
  }

  public set length(length: number) {
    this._lengthValue.value = length;
    this.syncToolSettingsProperties([{ value: this._lengthValue, propertyName: lengthDescription.name }]);
  }

  public get useAngle(): boolean {
    return this._useAngleValue.value as boolean;
  }

  public get angle(): number {
    return this._angleValue.value as number;
  }

  public set angle(angle: number) {
    this._angleValue.value = angle;
    this.syncToolSettingsProperties([{ value: this._angleValue, propertyName: angleDescription.name }]);
  }

  /** Used to supply DefaultToolSettingProvider with a list of properties to use to generate ToolSettings.  If undefined then no ToolSettings will be displayed */
  public supplyToolSettingsProperties(): ToolSettingsPropertyRecord[] | undefined {
    const toolSettings = new Array<ToolSettingsPropertyRecord>();
    toolSettings.push(new ToolSettingsPropertyRecord(this._useLengthValue.clone() as PrimitiveValue, useLengthDescription, { rowPriority: 0, columnPriority: 0 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._lengthValue.clone() as PrimitiveValue, lengthDescription, { rowPriority: 0, columnPriority: 1 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._useAngleValue.clone() as PrimitiveValue, useAngleDescription, { rowPriority: 1, columnPriority: 0 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._angleValue.clone() as PrimitiveValue, angleDescription, { rowPriority: 1, columnPriority: 1 }));
    return toolSettings;
  }

  /** Used to send changes from UI back to Tool */
  public applyToolSettingPropertyChange(updatedValue: ToolSettingsPropertySyncItem): boolean {
    switch (updatedValue.propertyName) {
      case useLengthDescription.name:
        this._useLengthValue.update(updatedValue.value);
        break;
      case lengthDescription.name:
        this._lengthValue.update(updatedValue.value);
        break;
      case useAngleDescription.name:
        this._useAngleValue.update(updatedValue.value);
        break;
      case angleDescription.name:
        this._angleValue.update(updatedValue.value);
        break;
      default:
        return false;
    }
    // return true is change is valid
    return true;
  }

  /** Used by DefaultToolSettingProvider to register to receive changes from tool .... like updating length or angle  */
  public set toolSettingPropertyChangeHandler(changeFunc: (propertyValues: ToolSettingsPropertySyncItem[]) => void) {
    this._changeFunc = changeFunc;
  }

  /** Called by tool to update the UI with changed made by tool */
  public syncToolSettingsProperties(propertyValues: ToolSettingsPropertySyncItem[]) {
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
      const changeHandler = (syncItems: ToolSettingsPropertySyncItem[]): void => {
        const syncValue = syncItems[0].value;
        (selectToolSettings[0].value as ToolSettingsValue).update(syncValue);
      };

      mockSelectTool.toolSettingPropertyChangeHandler = changeHandler;

      // simulate UI changing property value
      const updatedSelectPropertyValue = selectToolSettings[0].value as ToolSettingsValue;
      updatedSelectPropertyValue.value = SelectOptions.Method_Box;
      const syncItem: ToolSettingsPropertySyncItem = { value: updatedSelectPropertyValue, propertyName: selectToolSettings[0].property.name };
      mockSelectTool.applyToolSettingPropertyChange(syncItem);

      expect(mockSelectTool.selectionOption).to.be.equal(SelectOptions.Method_Box);

      // simulate tool changing property value which should trigger change handler
      mockSelectTool.selectionOption = SelectOptions.Mode_Remove;

      expect(mockSelectTool.selectionOption).to.be.equal(SelectOptions.Mode_Remove);
      expect(updatedSelectPropertyValue.value).to.be.equal(SelectOptions.Mode_Remove);
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
      const changeHandler = (syncItems: ToolSettingsPropertySyncItem[]): void => {
        syncItems.forEach((item) => {
          switch (item.propertyName) {
            case useLengthDescription.name:
              (lineToolSettings[0].value as ToolSettingsValue).update(item.value);
              break;
            case lengthDescription.name:
              (lineToolSettings[1].value as ToolSettingsValue).update(item.value);
              break;
            case useAngleDescription.name:
              (lineToolSettings[2].value as ToolSettingsValue).update(item.value);
              break;
            case angleDescription.name:
              (lineToolSettings[3].value as ToolSettingsValue).update(item.value);
              break;
          }
        });
      };

      mockPlaceLineTool.toolSettingPropertyChangeHandler = changeHandler;

      // simulate changing useLengthValue value in UI
      const updatedUseLengthValue = lineToolSettings[0].value as ToolSettingsValue;
      updatedUseLengthValue.value = true;
      mockPlaceLineTool.applyToolSettingPropertyChange({ value: updatedUseLengthValue, propertyName: lineToolSettings[0].property.name });
      expect(mockPlaceLineTool.useLength).to.be.equal(true);

      // simulate changing lengthValue value in UI
      const updatedLengthValue = lineToolSettings[1].value as ToolSettingsValue;
      updatedLengthValue.value = 22.22;
      mockPlaceLineTool.applyToolSettingPropertyChange({ value: updatedLengthValue, propertyName: lineToolSettings[1].property.name });
      expect(mockPlaceLineTool.length).to.be.equal(22.22);

      // simulate changing useAngleValue value in UI
      const updatedUseAngleValue = lineToolSettings[0].value as ToolSettingsValue;
      updatedUseAngleValue.value = true;
      mockPlaceLineTool.applyToolSettingPropertyChange({ value: updatedUseAngleValue, propertyName: lineToolSettings[2].property.name });
      expect(mockPlaceLineTool.useAngle).to.be.equal(true);

      // simulate changing angleValue value in UI
      const updatedAngleValue = lineToolSettings[1].value as ToolSettingsValue;
      updatedLengthValue.value = 3.14;
      mockPlaceLineTool.applyToolSettingPropertyChange({ value: updatedAngleValue, propertyName: lineToolSettings[3].property.name });
      expect(mockPlaceLineTool.angle).to.be.equal(3.14);

      // simulate tool changing property value which should trigger change handler
      mockPlaceLineTool.length = 16.67;
      expect(mockPlaceLineTool.length).to.be.equal(16.67);
      expect((lineToolSettings[1].value as ToolSettingsValue).value).to.be.equal(16.67);

      mockPlaceLineTool.angle = 1.57;
      expect(mockPlaceLineTool.angle).to.be.equal(1.57);
      expect((lineToolSettings[3].value as ToolSettingsValue).value).to.be.equal(1.57);
    }
  });

});
