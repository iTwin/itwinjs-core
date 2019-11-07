/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import { StatusBarItem, StatusBarItemUtilities, UiFramework } from "../../ui-framework";
import { StatusBarSection } from "../../ui-framework/statusbar/StatusBarItem";

describe("StatusBarManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("StatusBarManager should contain 0 items by default", () => {
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(0);
  });

  it("should add & remove one item to StatusBarManager items", () => {
    UiFramework.statusBarManager.itemsManager.removeAll();

    const item = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

    UiFramework.statusBarManager.itemsManager.add(item);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(1);

    UiFramework.statusBarManager.itemsManager.remove(item.id);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(0);
  });

  it("attempt to set duplicate items ignores it", () => {
    UiFramework.statusBarManager.itemsManager.removeAll();

    const item = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

    UiFramework.statusBarManager.itemsManager.add(item);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(1);

    UiFramework.statusBarManager.itemsManager.items = UiFramework.statusBarManager.itemsManager.items;
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(1);
  });

  it("attempt to add duplicate item ignores it", () => {
    UiFramework.statusBarManager.itemsManager.removeAll();

    const item = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

    UiFramework.statusBarManager.itemsManager.add(item);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(1);

    UiFramework.statusBarManager.itemsManager.add(item);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(1);
  });

  it("should add & remove multiple items to StatusBarManager items", () => {
    UiFramework.statusBarManager.itemsManager.removeAll();

    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <div />),
      StatusBarItemUtilities.createStatusBarItem("test2", StatusBarSection.Center, 1, <div />),
      StatusBarItemUtilities.createStatusBarItem("test3", StatusBarSection.Right, 1, <div />),
    ];

    UiFramework.statusBarManager.itemsManager.add(items);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(3);

    const itemIds = items.map((item) => item.id);
    UiFramework.statusBarManager.itemsManager.remove(itemIds);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(0);
  });

  it("createStatusBarItem should support itemProps", () => {
    const newId = "new-id";
    const item = StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <div />, { id: newId });
    expect(item.id).to.eq(newId);
  });

});
