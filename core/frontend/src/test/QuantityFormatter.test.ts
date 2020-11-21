/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Format, FormatterSpec, ParseResult, ParserSpec, QuantityError, QuantityStatus, UnitsProvider } from "@bentley/imodeljs-quantity";
import { CustomFormatter, QuantityFormatter, QuantityType } from "../QuantityFormatter";

class MyNewFormatter implements CustomFormatter {
  public formatQuantity(_magnitude: number, spec: FormatterSpec): string {
    if (undefined !== spec)
      return "MyNewFormatter";
    return `shouldn't get here: spec is undefined: ${undefined !== spec}`;
  }
  public parseIntoQuantityValue(_inString: string, _spec: ParserSpec): ParseResult {
    throw new Error("Method not implemented.");
  }
}

class MyNewFormat extends Format {
  private _myProp: string = "";

  public get myProp(): string { return this._myProp; };

  protected async loadCustomPropsFromJson(_unitsProvider: UnitsProvider, jsonObj: any): Promise<void> {
    if (undefined !== jsonObj.myProp) {
      if (typeof (jsonObj.myProp) !== "string") // MyProp must be a string IF it is defined
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'MyProp' attribute. It should be of type 'string'.`);
      this._myProp = jsonObj.myProp;
    }
  }

  protected addCustomPropsToJson(schemaJson: any) {
    schemaJson.myProp = this.myProp;
    return schemaJson;
  }
}

const defaultFormatProps = {
  composite: {
    includeZero: true,
    spacer: " ",
    units: [
      {
        label: "m",
        name: "Units.M",
      },
    ],
  },
  formatTraits: ["keepSingleZero", "showUnitLabel"],
  precision: 4,
  type: "Decimal",
};

const invalidFormatProps = {
  composite: {
    includeZero: "invalid",
  },
};

describe.only("Quantity formatter", async () => {
  let quantityFormatter: QuantityFormatter;
  beforeEach(async () => {
    quantityFormatter = new QuantityFormatter();
    await quantityFormatter.loadFormatAndParsingMaps(true);
  });

  it("Throws when passing invalid quantity type.", async () => {
    let hasThrown = false;
    try {
      await quantityFormatter.getFormatterSpecByQuantityType("invalid type");
    } catch (e) {
      hasThrown = true;
    }
    assert.isTrue(hasThrown);
  });

  it("Throws when registering formatter with invalid format properties.", async () => {
    let hasThrown = false;
    try {
      await quantityFormatter.registerCustomQuantityFormatter("newQuantityType", MyNewFormatter, MyNewFormat, invalidFormatProps);
    } catch (e) {
      hasThrown = true;
    }
    assert.isTrue(hasThrown);
  });


  it("Length", async () => {
    const expected = `405'-0 1/2"`;
    const newFormatterSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length);

    const actual = quantityFormatter.formatQuantity(123.456, newFormatterSpec);
    assert.equal(actual, expected);
  });

  it("Registering new formatter and no format", async () => {
    const expected = "MyNewFormatter";
    const isRegisterSuccessful = await quantityFormatter.registerCustomQuantityFormatter("newQuantityType", MyNewFormatter);
    assert.isTrue(isRegisterSuccessful);
    const newFormatterSpec = await quantityFormatter.getFormatterSpecByQuantityType("newQuantityType");

    const actual = quantityFormatter.formatQuantity(0, newFormatterSpec);
    assert.equal(actual, expected);
  });

  it("Registering new formatter with custom format returns correct format", async () => {
    const expected = "MyCustomProperty";
    const jsonProps = {
      ...defaultFormatProps,
      myProp: expected,
    };
    const isRegisterSuccessful = await quantityFormatter.registerCustomQuantityFormatter("newQuantityType", MyNewFormatter, MyNewFormat, jsonProps);
    assert.isTrue(isRegisterSuccessful);
    const newFormatterSpec = await quantityFormatter.getFormatterSpecByQuantityType("newQuantityType");
    assert.equal((newFormatterSpec.format as MyNewFormat).myProp, expected);
  });

  it("Registering new length override", async () => {
    const overrideEntry = {
      metric: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "cm", name: "Units.CM" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
      imperial: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "in", name: "Units.IN" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
    };

    const metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, false);
    const metricFormattedValue = quantityFormatter.formatQuantity(1.5, metricFormatSpec);
    assert.equal(metricFormattedValue, "1.5 m");

    const imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, true);
    const imperialFormattedValue = quantityFormatter.formatQuantity(1.5, imperialFormatSpec);
    assert.equal(imperialFormattedValue, `4'-11"`);

    await quantityFormatter.setOverrideFormats(QuantityType.Length, overrideEntry);
    const overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, false);
    const overrideMetricFormattedValue = quantityFormatter.formatQuantity(1.5, overrideMetricFormatSpec);
    assert.equal(overrideMetricFormattedValue, "150 cm");

    const overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, true);
    const overrideImperialFormattedValue = quantityFormatter.formatQuantity(1.5, overrideImperialFormatSpec);
    assert.equal(overrideImperialFormattedValue, "59.0551 in");
  });

});

