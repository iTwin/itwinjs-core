/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { PropertyDescription, PropertyRecord, PropertyValue, PropertyValueFormat, StandardTypeNames } from "../../appui-abstract";
import { ArrayValue, PrimitiveValue, StructValue } from "../../appui-abstract/properties/Value";

const value1: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, value: 3 };
const value2: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, value: 10 };

const getPropertyDescription = (): PropertyDescription => {
  return {
    name: "Item1",
    displayLabel: "Item One",
    typename: StandardTypeNames.Number,
  };
};

const getUpdatedPropertyDescription = (): PropertyDescription => {
  return {
    name: "Item1",
    displayLabel: "Update Item One",
    typename: StandardTypeNames.Number,
  };
};

describe("PropertyRecord", () => {

  describe("copyWithNewValue", () => {

    it("should have new value", () => {
      const sut = new PropertyRecord(value1, getPropertyDescription());
      const newRecord = sut.copyWithNewValue(value2);

      expect(newRecord.value).to.eq(value2);
    });

    it("should have new value and description", () => {
      const sut = new PropertyRecord(value1, getPropertyDescription());
      const newDescription = getUpdatedPropertyDescription();
      const newRecord = sut.copyWithNewValue(value2, newDescription);
      expect(newRecord.value).to.eq(value2);
      expect(newRecord.property.displayLabel).to.eq(newDescription.displayLabel);
    });

    it("should copy all attributes from source", () => {
      const src = new PropertyRecord(value1, getPropertyDescription());
      src.autoExpand = true;
      src.description = "test";
      src.extendedData = { a: "b" };
      src.isDisabled = true;
      src.isMerged = true;
      src.isReadonly = true;
      src.links = {
        matcher: () => [],
        onClick: () => { },
      };
      const newRecord = src.copyWithNewValue(value2);
      expect(newRecord).to.deep.eq({ ...src, value: value2 });
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

  describe("getChildrenRecords", () => {
    it("should return empty array for primitive record", () => {
      const arrayValue: PrimitiveValue = {
        valueFormat: PropertyValueFormat.Primitive,
        value: "value",
        displayValue: "display value",
      };

      const record = new PropertyRecord(arrayValue, getPropertyDescription());

      expect(record.getChildrenRecords()).to.deep.equal([]);
    });

    it("should return array children for array record", () => {
      const arrayValue: ArrayValue = {
        valueFormat: PropertyValueFormat.Array,
        items: [
          PropertyRecord.fromString("ArrayChild1"),
          PropertyRecord.fromString("ArrayChild2"),
        ],
        itemsTypeName: StandardTypeNames.String,
      };

      const record = new PropertyRecord(arrayValue, getPropertyDescription());

      expect(record.getChildrenRecords()).to.deep.equal(arrayValue.items);
    });

    it("should return members children for struct record", () => {
      const structChildren: PropertyRecord[] = [
        PropertyRecord.fromString("structChild1"),
        PropertyRecord.fromString("structChild2"),
      ];

      const structValue: StructValue = {
        valueFormat: PropertyValueFormat.Struct,
        members: {
          structChild1: structChildren[0],
          structChild2: structChildren[1],
        },
      };

      const record = new PropertyRecord(structValue, getPropertyDescription());

      expect(record.getChildrenRecords()).to.deep.equal(structChildren);
    });
  });
});
