/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";

import { PropertyValue, PropertyDescription, PropertyRecord, PropertyValueFormat } from "../../ui-abstract";

const value1: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, value: 3 };
const value2: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, value: 10 };

const getPropertyDescription = (): PropertyDescription => {
  return {
    name: "Item1",
    displayLabel: "Item One",
    typename: "number",
  };
};

describe("PropertyRecord", () => {

  describe("copyWithNewValue", () => {

    it("should have new value", () => {
      const sut = new PropertyRecord(value1, getPropertyDescription());
      const newRecord = sut.copyWithNewValue(value2);

      expect(newRecord.value).to.eq(value2);
    });

  });

  describe("fromString", () => {

    it("should create a valid PropertyRecord with provided description", () => {
      const description = getPropertyDescription();
      const record = PropertyRecord.fromString("test", description);
      expect(record).to.matchSnapshot();
    });

    it("should create a valid PropertyRecord with provided description name", () => {
      const record = PropertyRecord.fromString("test value", "test description");
      expect(record).to.matchSnapshot();
    });

    it("should create a valid PropertyRecord without description", () => {
      const record = PropertyRecord.fromString("test");
      expect(record).to.matchSnapshot();
    });

  });

});
