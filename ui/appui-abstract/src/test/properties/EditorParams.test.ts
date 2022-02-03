/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type {
  ButtonGroupEditorParams, ColorEditorParams, CustomFormattedNumberParams, IconListEditorParams, InputEditorSizeParams, SuppressLabelEditorParams} from "../../appui-abstract";
import { isButtonGroupEditorParams,
  isColorEditorParams, isCustomFormattedNumberParams, isIconListEditorParams, isInputEditorSizeParams, isSuppressLabelEditorParams,
  PropertyEditorParamTypes,
} from "../../appui-abstract";

describe("EditorParams", () => {
  it("should evaluate types correctly", () => {
    const ieParams: InputEditorSizeParams = { type: PropertyEditorParamTypes.InputEditorSize, size: 20, maxLength: 50 };
    expect(isInputEditorSizeParams(ieParams)).to.be.true;

    const colorParams: ColorEditorParams = { type: PropertyEditorParamTypes.ColorData, colorValues: [5, 6, 7], numColumns: 3 };
    expect(isColorEditorParams(colorParams)).to.be.true;

    const iconListParams: IconListEditorParams = { type: PropertyEditorParamTypes.IconListData, iconValue: "icon-placeholder", iconValues: ["icon-placeholder", "icon-2", "icon-3"], numColumns: 1 };
    expect(isIconListEditorParams(iconListParams)).to.be.true;

    const bgParams: ButtonGroupEditorParams = { type: PropertyEditorParamTypes.ButtonGroupData, buttons: [{ iconSpec: "iconspec-1" }, { iconSpec: "iconspec-2" }] };
    expect(isButtonGroupEditorParams(bgParams)).to.be.true;

    const suppressParams: SuppressLabelEditorParams = { type: PropertyEditorParamTypes.SuppressEditorLabel };
    expect(isSuppressLabelEditorParams(suppressParams)).to.be.true;

    const customParams: CustomFormattedNumberParams = {
      type: PropertyEditorParamTypes.CustomFormattedNumber,
      formatFunction: (numberValue: number) => `${numberValue}`,
      parseFunction: (_stringValue: string) => { return { value: 1.0 }; }, // eslint-disable-line arrow-body-style
    };
    expect(isCustomFormattedNumberParams(customParams)).to.be.true;
  });
});
