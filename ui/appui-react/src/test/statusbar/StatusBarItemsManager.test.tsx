/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { StatusBarSection } from "@itwin/appui-abstract";
import { StatusBarItem, StatusBarItemsManager, StatusBarItemUtilities } from "../../appui-react";

describe("StatusBarItemsManager", () => {

  describe("items", () => {
    it("should contain 0 items by default", () => {
      const sut = new StatusBarItemsManager(); // eslint-disable-line deprecation/deprecation
      expect(sut.items.length).to.eq(0);
    });
  });

  describe("add & remove", () => {
    it("should add & remove one item", () => {
      const sut = new StatusBarItemsManager(); // eslint-disable-line deprecation/deprecation

      const item = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.remove(item.id);
      expect(sut.items.length).to.eq(0);
    });

    it("attempt to set duplicate items ignores it", () => {
      const sut = new StatusBarItemsManager(); // eslint-disable-line deprecation/deprecation

      const item = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.items = sut.items;
      expect(sut.items.length).to.eq(1);
    });

    it("add ignores duplicate items", () => {
      const sut = new StatusBarItemsManager(); // eslint-disable-line deprecation/deprecation

      const item1 = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);
      const item2 = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

      sut.add([item1, item2]);
      sut.items.length.should.eq(1);
    });

    it("attempt to add duplicate item ignores it", () => {
      const sut = new StatusBarItemsManager(); // eslint-disable-line deprecation/deprecation

      const item = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.add(item);
      expect(sut.items.length).to.eq(1);
    });

    it("should add & remove multiple items to StatusBarManager items", () => {
      const sut = new StatusBarItemsManager(); // eslint-disable-line deprecation/deprecation

      const items: StatusBarItem[] = [
        StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <div />),
        StatusBarItemUtilities.createStatusBarItem("test2", StatusBarSection.Center, 1, <div />),
        StatusBarItemUtilities.createStatusBarItem("test3", StatusBarSection.Right, 1, <div />),
      ];

      sut.add(items);
      expect(sut.items.length).to.eq(3);

      const itemIds = items.map((item) => item.id);
      sut.remove(itemIds);
      expect(sut.items.length).to.eq(0);
    });
  });

});
