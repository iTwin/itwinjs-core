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

describe ("records", () => {
  it("should have new value", () => {
    const sut = new PropertyRecord (value1, getPropertyDescription());
    const newRecord = sut.copyWithNewValue(value2);

    expect(newRecord.value).to.eq(value2);
  });
});
