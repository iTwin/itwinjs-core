/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import { UiFramework, StatusBarItemUtilities, StatusBarSection } from "../../ui-framework";

describe("StatusBarManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should contain 0 items by default", () => {
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(0);
  });

  it("should add & remove one item", () => {
    UiFramework.statusBarManager.itemsManager.removeAll();
    const item = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

    UiFramework.statusBarManager.itemsManager.add(item);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(1);

    UiFramework.statusBarManager.itemsManager.remove(item.id);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(0);
  });

});
