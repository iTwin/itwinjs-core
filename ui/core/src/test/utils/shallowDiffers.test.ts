/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallowDiffers } from "../../core-react";

describe("shallowDiffers", () => {
  it("should return false with the same object", () => {
    const object = { test: 2 };
    expect(shallowDiffers(object, object)).to.be.false;
  });
  it("should return true if either one object is undefined", () => {
    const object = { test: 2 };
    expect(shallowDiffers(undefined, object)).to.be.true;
    expect(shallowDiffers(object, undefined)).to.be.true;
  });
  it("should return true if objects' keys do not match", () => {
    const object1 = { test: 2 };
    const object2 = { test: 2, test2: 1 };
    expect(shallowDiffers(object1, object2)).to.be.true;
    expect(shallowDiffers(object2, object1)).to.be.true;
  });
  it("should return true if objects' values do not match", () => {
    const object1 = { test: 2, test2: 2 };
    const object2 = { test: 2, test2: 1 };
    expect(shallowDiffers(object1, object2)).to.be.true;
    expect(shallowDiffers(object2, object1)).to.be.true;
  });
  it("should return false if objects' keys and values match", () => {
    const object1 = { test: 2, test2: 1 };
    const object2 = { test: 2, test2: 1 };
    expect(shallowDiffers(object1, object2)).to.be.false;
    expect(shallowDiffers(object2, object1)).to.be.false;
  });
});
