/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { expect } from "chai";
import TestUtils from "../TestUtils";
import { CustomItemDef } from "../../ui-framework/shared/CustomItemDef";

describe("CustomItemDef", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
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

});
