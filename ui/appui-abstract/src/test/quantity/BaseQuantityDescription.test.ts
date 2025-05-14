/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BaseQuantityDescription, ParseResults } from "../../appui-abstract";

describe("BaseQuantityDescription", () => {
  it("mock quantity", () => {
    class QuantityDescription extends BaseQuantityDescription {
      constructor(name: string, displayLabel: string, iconSpec?: string, kindOfQuantityName?: string) {
        super(name, displayLabel, iconSpec, kindOfQuantityName);
      }

      protected formatValue = (_numberValue: number): string => {
        return ("This is the number");
      };

      protected parseString(_userInput: string): ParseResults {
        return { value: 10 };
      }

      public get quantityType(): string { return this.quantityType; }
      public set quantityType(name: string) { this.quantityType = name; }
      public get parseError(): string { return "MockError"; }
    }
    const sut = new QuantityDescription("mockQuantity", "Mock Quantity", "icon-placeholder",  "Mock KoQ Name");
    const formattedValue = sut.format(5);
    expect(formattedValue).to.eq("This is the number");
    const results = sut.parse("mock value");
    expect(results.value).to.eq(10);
    const quantityType = sut.kindOfQuantityName;
    expect(quantityType).to.eq("Mock KoQ Name");
    const parseError = sut.parseError;
    expect(parseError).to.eq("MockError");
  });
});
