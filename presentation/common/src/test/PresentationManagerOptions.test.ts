/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ComputeSelectionRequestOptions,
  isComputeSelectionRequestOptions,
  isSingleElementPropertiesRequestOptions,
  SelectionScopeRequestOptions,
} from "../presentation-common";
import { createRandomId } from "./_helpers";

describe("isSingleElementPropertiesRequestOptions", () => {
  it("return correct result for different element properties request options", () => {
    expect(isSingleElementPropertiesRequestOptions<undefined>({ imodel: undefined, elementId: "0x1" })).to.be.true;
    expect(isSingleElementPropertiesRequestOptions<undefined>({ imodel: undefined, elementClasses: ["TestSchema:TestClass"] })).to.be.false;
  });
});

describe("isComputeSelectionRequestOptions ", () => {
  it("returns `false` for `SelectionScopeRequestOptions`", () => {
    const opts: SelectionScopeRequestOptions<any> = {
      imodel: undefined,
    };
    expect(isComputeSelectionRequestOptions(opts)).to.be.false;
  });

  it("returns `true` for `ComputeSelectionRequestOptions`", () => {
    const opts: ComputeSelectionRequestOptions<any> = {
      imodel: undefined,
      elementIds: [createRandomId(), createRandomId()],
      scope: { id: "test" },
    };
    expect(isComputeSelectionRequestOptions(opts)).to.be.true;
  });
});
