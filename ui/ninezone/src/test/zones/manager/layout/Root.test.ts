/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Root } from "../../../../ui-ninezone";
import { Rectangle } from "../../../../ui-ninezone/utilities/Rectangle";

describe("Root", () => {
  it("should construct an instance", () => {
    new Root(new Rectangle(), false);
  });
});
