/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { isSingleElementPropertiesRequestOptions } from "../presentation-common";

describe("isSingleElementPropertiesRequestOptions", () => {
  it("return correct result for different element properties request options", () => {
    expect(isSingleElementPropertiesRequestOptions<undefined>({ imodel: undefined, elementId: "0x1" })).to.be.true;
    expect(isSingleElementPropertiesRequestOptions<undefined>({ imodel: undefined, elementClasses: ["TestSchema:TestClass"] })).to.be.false;
  });
});
