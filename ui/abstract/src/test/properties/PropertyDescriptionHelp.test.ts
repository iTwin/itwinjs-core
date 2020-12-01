/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  PropertyDescriptionHelper, PropertyEditorParamTypes, SuppressLabelEditorParams,
} from "../../ui-abstract";

describe("PropertyDescriptionHelper", () => {
  const testName = "name";
  const testLabel = "label";

  const additionParam = [{
    type: PropertyEditorParamTypes.SuppressEditorLabel,
    suppressLabelPlaceholder: true,
  } as SuppressLabelEditorParams];

  describe("WeightPicker Description", () => {
    const typename = "number";

    it("should build correctly", () => {
      const editor = "weight-picker";
      const editorDescription = PropertyDescriptionHelper.buildWeightPickerDescription(testName, testLabel);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(0);
    });

    it("should build with additional editor params correctly", () => {
      const editor = "weight-picker";
      const editorDescription = PropertyDescriptionHelper.buildWeightPickerDescription(testName, testLabel, additionParam);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(1);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.SuppressEditorLabel);
    });
  });

  describe("TextEditor Description", () => {
    const typename = "string";
    it("should build correctly", () => {
      const editor = undefined;
      const editorDescription = PropertyDescriptionHelper.buildTextEditorDescription(testName, testLabel);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(0);
    });

    it("should build with additional editor params correctly", () => {
      const editor = undefined;
      const editorDescription = PropertyDescriptionHelper.buildTextEditorDescription(testName, testLabel, additionParam);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(1);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.SuppressEditorLabel);
    });
  });

  describe("EnumPicklistEditor Description", () => {
    const choices = [
      { label: "Red", value: 1 },
      { label: "White", value: 2 },
      { label: "Blue", value: 3 },
      { label: "Yellow", value: 4 },
    ];

    const typename = "enum";
    it("should build correctly", () => {
      const editor = undefined;
      const editorDescription = PropertyDescriptionHelper.buildEnumPicklistEditorDescription(testName, testLabel, choices);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params).to.eq(undefined);
      expect(editorDescription.enum?.choices).to.eq(choices);
    });

    it("should build with additional editor params correctly", () => {
      const editor = undefined;
      const editorDescription = PropertyDescriptionHelper.buildEnumPicklistEditorDescription(testName, testLabel, choices, additionParam);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.enum?.choices).to.eq(choices);
      expect(editorDescription.editor?.params?.length).to.eq(1);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.SuppressEditorLabel);
    });
  });

  describe("ColorPickerEditor Description", () => {
    const colors = [0x0000ff, 0xff0000, 0x00ff00];

    const typename = "number";
    it("should build correctly", () => {
      const editor = "color-picker";
      const editorDescription = PropertyDescriptionHelper.buildColorPickerDescription(testName, testLabel, colors, 1);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(1);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.ColorData);
    });

    it("should build with additional editor params correctly", () => {
      const editor = "color-picker";
      const editorDescription = PropertyDescriptionHelper.buildColorPickerDescription(testName, testLabel, colors, 1, additionParam);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(2);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.ColorData);
      expect(editorDescription.editor?.params?.[1].type).to.eq(PropertyEditorParamTypes.SuppressEditorLabel);
    });
  });

  describe("Toggle Description", () => {
    const typename = "boolean";
    it("should build correctly", () => {
      const editor = "toggle";
      const editorDescription = PropertyDescriptionHelper.buildToggleDescription(testName, testLabel);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(0);
    });

    it("should build with additional editor params correctly", () => {
      const editor = "toggle";
      const editorDescription = PropertyDescriptionHelper.buildToggleDescription(testName, testLabel, additionParam);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(1);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.SuppressEditorLabel);
    });
  });

  describe("ImageCheckBox Description", () => {
    const typename = "boolean";
    const imageOff = "off";
    const imageOn = "on";
    it("should build correctly", () => {
      const editor = "image-check-box";
      const editorDescription = PropertyDescriptionHelper.buildImageCheckBoxDescription(testName, testLabel, imageOff, imageOn);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(1);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.CheckBoxImages);
    });

    it("should build with additional editor params correctly", () => {
      const editor = "image-check-box";
      const editorDescription = PropertyDescriptionHelper.buildImageCheckBoxDescription(testName, testLabel, imageOff, testLabel, additionParam);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(2);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.CheckBoxImages);
      expect(editorDescription.editor?.params?.[1].type).to.eq(PropertyEditorParamTypes.SuppressEditorLabel);
    });
  });

  describe("Checkbox Description", () => {
    const typename = "boolean";
    it("should build correctly", () => {
      const editor = undefined;
      const editorDescription = PropertyDescriptionHelper.buildCheckboxDescription(testName, testLabel);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(0);
    });

    it("should build with additional editor params correctly", () => {
      const editor = undefined;
      const editorDescription = PropertyDescriptionHelper.buildCheckboxDescription(testName, testLabel, additionParam);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(1);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.SuppressEditorLabel);
    });
  });
});
