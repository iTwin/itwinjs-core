/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type {
  EnumerationChoice, IconEditorParams, RangeEditorParams, SuppressLabelEditorParams} from "../../appui-abstract";
import { PropertyDescriptionHelper, PropertyEditorParamTypes,
} from "../../appui-abstract";

// cSpell:ignore Picklist

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

  describe("NumberEditor Description", () => {
    const typename = "number";
    it("should build correctly", () => {
      const editor = "numeric-input";
      const editorDescription = PropertyDescriptionHelper.buildNumberEditorDescription(testName, testLabel);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(1);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.Range);

    });

    it("should build with additional editor params correctly", () => {
      const editor = "numeric-input";
      const numberParam = {
        type: PropertyEditorParamTypes.Range,
        step: 2,
        precision: 0,
        minimum: 0,
        maximum: 1000,
      } as RangeEditorParams;
      const editorDescription = PropertyDescriptionHelper.buildNumberEditorDescription(testName, testLabel, numberParam, additionParam);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq(testLabel);
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(2);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.Range);
      expect(editorDescription.editor?.params?.[1].type).to.eq(PropertyEditorParamTypes.SuppressEditorLabel);
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

    it("should build a standard lock property description", () => {
      const editor = undefined;
      const editorDescription = PropertyDescriptionHelper.buildLockPropertyDescription(testName);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq("");
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(1);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.SuppressEditorLabel);
    });

    it("should build a standard lock property description with additional editor params correctly", () => {
      // Note: additional params just for testing, currently there are no additional params used by the lock checkbox.
      const lockAdditionParam = [{
        type: PropertyEditorParamTypes.Icon,
        definition: { iconSpec: "icon-test" },
      } as IconEditorParams];

      const editor = undefined;
      const editorDescription = PropertyDescriptionHelper.buildLockPropertyDescription(testName, lockAdditionParam);
      expect(editorDescription.name).to.eq(testName);
      expect(editorDescription.typename).to.eq(typename);
      expect(editorDescription.displayLabel).to.eq("");
      expect(editorDescription.editor?.name).to.eq(editor);
      expect(editorDescription.editor?.params?.length).to.eq(2);
      expect(editorDescription.editor?.params?.[0].type).to.eq(PropertyEditorParamTypes.SuppressEditorLabel);
    });
  });

  describe("bumpEnumProperty", () => {
    const noChoices: EnumerationChoice[] = [
    ];

    const choices = [
      { label: "Red", value: 1 },
      { label: "White", value: 2 },
      { label: "Blue", value: 3 },
      { label: "Yellow", value: 4 },
    ];

    const stringChoices = async (): Promise<EnumerationChoice[]> => {
      return [
        { label: "Red", value: "red" },
        { label: "White", value: "white" },
        { label: "Blue", value: "blue" },
        { label: "Yellow", value: "yellow" },
      ];
    };

    it("should bump numeric value correctly", async () => {
      const enumDescription = PropertyDescriptionHelper.buildEnumPicklistEditorDescription(testName, testLabel, choices);
      expect(enumDescription.enum?.choices).to.eq(choices);

      let newValue = await PropertyDescriptionHelper.bumpEnumProperty(enumDescription, 1);
      expect(newValue).to.eq(2);
      newValue = await PropertyDescriptionHelper.bumpEnumProperty(enumDescription, 4);
      expect(newValue).to.eq(1);
      newValue = await PropertyDescriptionHelper.bumpEnumProperty(enumDescription, 0);
      expect(newValue).to.eq(0);
    });

    it("should bump string value correctly", async () => {
      const enumDescription = PropertyDescriptionHelper.buildEnumPicklistEditorDescription(testName, testLabel, stringChoices());
      expect(enumDescription.enum?.choices).not.to.be.undefined;

      let newValue = await PropertyDescriptionHelper.bumpEnumProperty(enumDescription, "red");
      expect(newValue).to.eq("white");
      newValue = await PropertyDescriptionHelper.bumpEnumProperty(enumDescription, "yellow");
      expect(newValue).to.eq("red");
      newValue = await PropertyDescriptionHelper.bumpEnumProperty(enumDescription, "");
      expect(newValue).to.eq("");
    });

    it("should not bump with wrong type description", async () => {
      const booleanDescription = PropertyDescriptionHelper.buildCheckboxDescription(testName, testLabel);
      const newValue = await PropertyDescriptionHelper.bumpEnumProperty(booleanDescription, 1);
      expect(newValue).to.eq(1);
    });

    it("should not bump with no choices", async () => {
      const enumDescription = PropertyDescriptionHelper.buildEnumPicklistEditorDescription(testName, testLabel, noChoices);
      expect(enumDescription.enum?.choices).to.eq(noChoices);

      const newValue = await PropertyDescriptionHelper.bumpEnumProperty(enumDescription, 1);
      expect(newValue).to.eq(1);
    });
  });

});
