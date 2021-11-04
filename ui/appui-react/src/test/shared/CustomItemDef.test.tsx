/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { CustomItemDef } from "../../appui-react/shared/CustomItemDef";
import TestUtils from "../TestUtils";

describe("CustomItemDef", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("CustomItemDef with no commandId should get generated id", () => {
    const item = new CustomItemDef({
      reactElement: <div>Hello!</div>,
    });

    expect(item.id.substr(0, CustomItemDef.customIdPrefix.length)).to.eq(CustomItemDef.customIdPrefix);
  });

  it("CustomItemDef with commandId should use it", () => {
    const testId = "Test";
    const item = new CustomItemDef({
      customId: testId,
      reactElement: <div>Hello!</div>,
    });

    expect(item.id).to.eq(testId);
  });

  it("CustomItemDef that is not visible should return null from toolbarReactNode", () => {
    const testId = "Test";
    const item = new CustomItemDef({
      customId: testId,
      isVisible: false,
      reactElement: <div>Hello!</div>,
    });

    expect(item.toolbarReactNode()).to.eq(null);
  });

});
