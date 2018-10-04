/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { PropertyRecord, PrimitiveValue, PropertyDescription, PropertyValueFormat } from "../../src/properties";
import { SimplePropertyDataProvider, PropertyCategory } from "../../src/propertygrid";

class SamplePropertyRecord extends PropertyRecord {
  constructor(name: string, index: number, value: any, typename: string = "string", editor?: string) {
    const v: PrimitiveValue = {
      valueFormat: PropertyValueFormat.Primitive,
      value,
      displayValue: value.toString(),
    };
    const p: PropertyDescription = {
      name: name + index,
      displayLabel: name,
      typename,
    };
    if (editor)
      p.editor = { name: editor, params: [] };
    super(v, p);

    this.description = `${name} - description`;
    this.isReadonly = false;
  }
}

class SamplePropertyDataProvider extends SimplePropertyDataProvider {
  constructor() {
    super();

    const category: PropertyCategory = { name: "Group_1", label: "Group 1", expand: true };
    this.addCategory(category);

    const pr = new SamplePropertyRecord("CADID", 0, "0000 0005 00E0 02D8");
    this.addProperty(pr, 0);
  }
}

describe("SimplePropertyDataProvider", () => {

  let dataProvider: SamplePropertyDataProvider;

  beforeEach(() => {
    dataProvider = new SamplePropertyDataProvider();
  });

  it("getData works correctly", async () => {
    const propertyData = await dataProvider.getData();
    expect(propertyData.categories).to.have.length(1);

    const propertyCategory = propertyData.categories[0];
    expect(propertyCategory.name).to.equal("Group_1");
    expect(propertyCategory.label).to.equal("Group 1");
    expect(propertyCategory.expand).to.be.true;

    const records = propertyData.records[propertyCategory.name];
    expect(records).to.have.length(1);

    const record = records[0];
    const propertyDescription = record.property;
    expect(propertyDescription.displayLabel).to.equal("CADID");
    const propertyValue = record.value;
    expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
    const primitiveValue = propertyValue as PrimitiveValue;
    expect(primitiveValue.value).to.equal("0000 0005 00E0 02D8");
  });
});
