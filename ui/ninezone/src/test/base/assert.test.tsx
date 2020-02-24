/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "../../ui-ninezone";

describe("assert", () => {
  it("should not throw for truthy object", () => {
    (() => assert({})).should.not.throw();
  });

  it("should throw for falsy object", () => {
    (() => assert(undefined)).should.throw();
  });
});
