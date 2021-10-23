/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { DialogItem, DialogItemValue, DialogProperty, DialogPropertySyncItem, EditorPosition, PropertyDescriptionHelper } from "../../appui-abstract";

describe("DialogProperty", () => {
  const colorProperty = new DialogProperty<string>(PropertyDescriptionHelper.buildTextEditorDescription("color", "Color"), "blue", undefined);
  const diValue: DialogItemValue = { value: "yellow", displayValue: "Yellow" };

  describe("Color Property functions", () => {
    it("DialogPropertySyncItem test", () => {
      const syncItem: DialogPropertySyncItem = colorProperty.syncItem;
      expect(syncItem.isDisabled).to.be.undefined;
      expect(syncItem.propertyName).to.eq("color");
      expect(syncItem.value.value).to.eq("blue");
    });
    it("isDisabled test", () => {
      colorProperty.isDisabled = true;
      expect(colorProperty.isDisabled).to.be.true;
    });
    it("Value test", () => {
      colorProperty.value = "green";
      expect(colorProperty.value).to.eq("green");
    });
    it("DisplayValue test", () => {
      colorProperty.displayValue = "red";
      expect(colorProperty.displayValue).to.eq("red");
    });
    it("DialogItemValue test", () => {
      colorProperty.dialogItemValue = diValue;
      expect(colorProperty.dialogItemValue.value).to.eq("yellow");
      expect(colorProperty.dialogItemValue.displayValue).to.eq("Yellow");
    });
    it("toDialogItem test", () => {
      const position: EditorPosition = { rowPriority: 1, columnIndex: 2 };
      const item: DialogItem = colorProperty.toDialogItem(position);
      expect(item.editorPosition.rowPriority).to.eq(1);
      expect(item.editorPosition.columnIndex).to.eq(2);
    });
    it("to DialogPropertyItem test", () => {
      const item = colorProperty.item;
      expect(item.propertyName).to.eq("color");
      expect(item.value.value).to.eq("yellow");
      expect(item.value.displayValue).to.eq("Yellow");
    });

  });
  describe("Non-string types", () => {
    it("Number property test", () => {
      const numberProperty = new DialogProperty<number>(PropertyDescriptionHelper.buildTextEditorDescription("number", "Number"), 1, undefined);
      expect(numberProperty.dialogItemValue.value).to.eq(1);
    });
    it("Boolean property test", () => {
      const booleanProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildTextEditorDescription("boolean", "Boolean"), true, undefined);
      expect(booleanProperty.dialogItemValue.value).to.eq(true);
    });
    it("Undefined property test", () => {
      const undefinedProperty = new DialogProperty<undefined>(PropertyDescriptionHelper.buildTextEditorDescription("undefined", "Undefined"), undefined, undefined);
      expect(undefinedProperty.dialogItemValue.value).to.be.undefined;
    });
    it("Date property test", () => {
      const date = new Date();
      const dateProperty = new DialogProperty<Date>(PropertyDescriptionHelper.buildTextEditorDescription("date", "Date"), date, undefined);
      expect(dateProperty.dialogItemValue.value).to.eq(date);
    });
  });
});
