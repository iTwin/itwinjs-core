/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { StatusBarSection } from "@bentley/ui-abstract";

import { StatusBarItem, StatusBarItemUtilities, StatusBarItemsManager } from "../../ui-framework";

describe("StatusBarItemsManager", () => {

  describe("items", () => {
    it("should contain 0 items by default", () => {
      const sut = new StatusBarItemsManager();
      expect(sut.items.length).to.eq(0);
    });
  });

  describe("add & remove", () => {
    it("should add & remove one item", () => {
      const sut = new StatusBarItemsManager();

      const item = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.remove(item.id);
      expect(sut.items.length).to.eq(0);
    });

    it("attempt to set duplicate items ignores it", () => {
      const sut = new StatusBarItemsManager();

      const item = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.items = sut.items;
      expect(sut.items.length).to.eq(1);
    });

    it("add ignores duplicate items", () => {
      const sut = new StatusBarItemsManager();

      const item1 = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);
      const item2 = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

      sut.add([item1, item2]);
      sut.items.length.should.eq(1);
    });

    it("attempt to add duplicate item ignores it", () => {
      const sut = new StatusBarItemsManager();

      const item = StatusBarItemUtilities.createStatusBarItem("test", StatusBarSection.Left, 1, <div />);

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.add(item);
      expect(sut.items.length).to.eq(1);
    });

    it("should add & remove multiple items to StatusBarManager items", () => {
      const sut = new StatusBarItemsManager();

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

  describe("setIsVisible", () => {
    it("should set is visible", () => {
      const sut = new StatusBarItemsManager();
      sut.items = [
        StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <div />),
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.setIsVisible("test1", false);

      spy.calledOnce.should.true;
      sut.items[0].isVisible.should.false;
    });

    it("should not update if item is not found", () => {
      const sut = new StatusBarItemsManager();
      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.setIsVisible("test1", false);

      spy.calledOnce.should.false;
    });

    it("should not update if item visibility equals new visibility", () => {
      const sut = new StatusBarItemsManager();
      sut.items = [
        StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <div />),
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.setIsVisible("test1", true);

      spy.calledOnce.should.false;
    });
  });

});
