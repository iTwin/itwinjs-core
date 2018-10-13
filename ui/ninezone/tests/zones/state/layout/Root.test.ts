/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import Root from "../../../../src/zones/state/layout/Root";

describe("Root", () => {
  it("should construct an instance", () => {
    new Root({ height: 0, width: 0 }, false);
  });
});
