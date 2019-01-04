/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Root } from "../../../../ui-ninezone";

describe("Root", () => {
  it("should construct an instance", () => {
    new Root({ height: 0, width: 0 }, false);
  });
});
