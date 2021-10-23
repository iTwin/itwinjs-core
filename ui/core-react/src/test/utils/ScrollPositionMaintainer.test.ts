/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { using } from "@itwin/core-bentley";
import { ScrollPositionMaintainer } from "../../core-react";

describe("ScrollPositionMaintainer", () => {

  it("should restore scroll positions when disposed", () => {
    const child = document.createElement("div");
    child.scrollTop = 100;
    const parent = document.createElement("div");
    parent.scrollTop = 200;
    parent.appendChild(child);
    using(new ScrollPositionMaintainer(parent), (_) => {
      child.scrollTop = 888;
      parent.scrollTop = 999;
    });
    expect(child.scrollTop).to.eq(100);
    expect(parent.scrollTop).to.eq(200);
  });

});
