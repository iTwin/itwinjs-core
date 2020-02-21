/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";

import {
  PropertyValueFormat,
  ToolSettingsPropertyItem,
  ToolSettingsPropertyRecord,
  ToolSettingsPropertySyncItem,
  ToolSettingsValue,
} from "../../ui-abstract";

describe("ToolSettings", () => {
  describe("ToolSettingsValue", () => {
    it("constructor", () => {
      const sut = new ToolSettingsValue (10, "ten");

      sut.isNullValue.should.be.false;
      sut.hasDisplayValue.should.be.true;
      expect (sut.value).to.eq(10);
      expect (sut.displayValue).to.eq("ten");
    });
    it("update", () => {
      const sut = new ToolSettingsValue("Alabama", "AL");
      const updateVal = new ToolSettingsValue("Mississippi", "MS");

      const testVal = sut.update(sut);
      expect (testVal).to.be.false;
      expect (sut.value).to.eq("Alabama");
      sut.update(updateVal);
      expect (sut.value).to.eq(updateVal.value);
    });
    it("clone", () => {
      const sut = new ToolSettingsValue (true, "Yes");

      const clonedVal = sut.clone();

      expect (sut.value).to.eq (clonedVal.value);
      expect (sut.displayValue).to.eq(clonedVal.displayValue);
    });
  });
  describe("ToolSettingsPropertyItem", () => {
    it("constructor", () => {
      const val = new ToolSettingsValue(1, "one");
      const sut = new ToolSettingsPropertyItem (val, "One Item");

      sut.should.not.be.undefined;
      expect(sut.value).to.eq(val);
      expect(sut.propertyName).to.eq("One Item");
    });
  });
  describe("ToolSettingsPropertySyncItem", () => {
    it("constructor", () => {
      const val = new ToolSettingsValue(1, "one");
      const sut = new ToolSettingsPropertySyncItem (val, "One Item", true);

      expect(sut.isDisabled).to.be.true;
      expect(sut.value).to.eq(val);
      expect(sut.propertyName).to.eq("One Item");
    });
  });
  describe("ToolSettingsPropertyRecord", () => {
    it("constructor", () => {
      const val = new ToolSettingsValue(1, "one");
      const sut = new ToolSettingsPropertyRecord (val, {name: "item1", displayLabel: "Item One", typename: "number"}, {rowPriority: 0, columnIndex: 0} );

      expect(sut.lockProperty).to.be.undefined;
      expect(sut.isReadonly).to.be.false;
      expect(sut.property.name).to.eq("item1");
      expect(sut.property.displayLabel).to.eq("Item One");
      expect(sut.property.typename).to.eq("number");
    });
    it("clone", () => {
      const val = new ToolSettingsValue(1, "one");
      const val2 = new ToolSettingsValue(2, "Two");
      const sut = new ToolSettingsPropertyRecord (val, {name: "item1", displayLabel: "Item One", typename: "number"}, {rowPriority: 0, columnIndex: 0} );
      const clonedRecord = ToolSettingsPropertyRecord.clone(sut);
      const clonedRecord2 = ToolSettingsPropertyRecord.clone(sut, val2);

      expect(clonedRecord.value.valueFormat).to.eq(PropertyValueFormat.Primitive);
      expect(clonedRecord.property.name).to.eq("item1");
      expect(clonedRecord2.property.displayLabel).to.be.eq ("Item One");
    });
  });
});
