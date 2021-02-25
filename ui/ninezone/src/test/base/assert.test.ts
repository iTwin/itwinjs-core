/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";

describe("assert", () => {
  it("should not throw for truthy object", () => {
    (() => assert(!!{})).should.not.throw();
  });

  it("should throw for falsy object", () => {
    (() => assert(!!undefined)).should.throw();
  });
});
