/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";

import TestUtils from "../TestUtils";
import { UiFramework } from "../../ui-framework";
import { StatusBarItemsManager } from "../../ui-framework/statusbar/StatusBarItemsManager";

describe("StatusBarManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  afterEach(() => {
    UiFramework.statusBarManager.removeAll();
  });

  it("should not contain managers by default", () => {
    expect(UiFramework.statusBarManager.getItemsManager("test")).to.be.undefined;
  });

  it("should not be able to find get or remove managers that do not exist", () => {
    expect(UiFramework.statusBarManager.getItemsManager("test")).to.be.undefined;
    expect(UiFramework.statusBarManager.removeItemsManager("test")).to.be.false;
  });

  it("should add and remove a manager", () => {
    expect(UiFramework.statusBarManager.addItemsManager("test", new StatusBarItemsManager())).to.be.true;
    expect(UiFramework.statusBarManager.getItemsManager("test")).to.not.be.undefined;

    expect(UiFramework.statusBarManager.removeItemsManager("test")).to.be.true;
  });

  it("should not be able to add an existing manager", () => {
    expect(UiFramework.statusBarManager.addItemsManager("test", new StatusBarItemsManager())).to.be.true;
    expect(UiFramework.statusBarManager.getItemsManager("test")).to.not.be.undefined;

    expect(UiFramework.statusBarManager.addItemsManager("test", new StatusBarItemsManager())).to.be.false;
  });

});
