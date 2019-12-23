/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";

import {
  AbstractStatusBarItemUtilities, PluginStatusBarItemsManager, StatusBarSection,
  isAbstractStatusBarLabelItem, isAbstractStatusBarActionItem, isAbstractStatusBarCustomItem,
  StatusBarItemType, AbstractStatusBarCustomItem, CommonStatusBarItem,
} from "../../ui-abstract";

describe("PluginStatusBarItemsManager", () => {
  const createCustomItem = (id: string, section: StatusBarSection, itemPriority: number, itemProps?: Partial<AbstractStatusBarCustomItem>): AbstractStatusBarCustomItem => ({
    id, section, itemPriority,
    isVisible: true,
    type: StatusBarItemType.CustomItem,
    ...itemProps ? itemProps : {},
  });

  afterEach(() => sinon.restore());

  describe("items", () => {
    it("should contain 0 items by default", () => {
      const sut = new PluginStatusBarItemsManager();
      expect(sut.items.length).to.eq(0);
    });
  });

  describe("type guards", () => {
    it("should identify label item", () => {
      const item = AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");
      expect(isAbstractStatusBarLabelItem(item)).to.be.true;
      expect(isAbstractStatusBarActionItem(item)).to.be.false;
      expect(isAbstractStatusBarCustomItem(item)).to.be.false;
    });

    it("should identify action item", () => {
      const item = AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "test status bar from plugin", () => { });
      expect(isAbstractStatusBarActionItem(item)).to.be.true;
      expect(isAbstractStatusBarLabelItem(item)).to.be.false;
      expect(isAbstractStatusBarCustomItem(item)).to.be.false;
    });

    it("should identify custom item", () => {
      const item = createCustomItem("PluginTest:StatusBarItem1", StatusBarSection.Center, 100);
      expect(isAbstractStatusBarCustomItem(item)).to.be.true;
      expect(isAbstractStatusBarActionItem(item)).to.be.false;
      expect(isAbstractStatusBarLabelItem(item)).to.be.false;
    });
  });

  describe("add & remove", () => {
    it("should add & remove one item", () => {
      const sut = new PluginStatusBarItemsManager();

      const item = AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");
      expect(isAbstractStatusBarLabelItem(item)).to.be.true;
      expect(isAbstractStatusBarActionItem(item)).to.be.false;

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.remove(item.id);
      expect(sut.items.length).to.eq(0);
    });

    it("attempt to set duplicate items ignores it", () => {
      const sut = new PluginStatusBarItemsManager();

      const item = AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.items = sut.items;
      expect(sut.items.length).to.eq(1);
    });

    it("add ignores duplicate items", () => {
      const sut = new PluginStatusBarItemsManager();

      const item1 = AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");
      const item2 = AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");
      sut.add([item1, item2]);
      sut.items.length.should.eq(1);
    });

    it("attempt to add duplicate item ignores it", () => {
      const sut = new PluginStatusBarItemsManager();

      const item = AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.add(item);
      expect(sut.items.length).to.eq(1);
    });

    it("should add & remove multiple items to StatusBarManager items", () => {
      const sut = new PluginStatusBarItemsManager();

      const items: CommonStatusBarItem[] = [
        AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello"),
        AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem2", StatusBarSection.Center, 100, "icon-developer", "test status bar from plugin", () => { }),
        createCustomItem("PluginTest:StatusBarItem3", StatusBarSection.Center, 100),
      ];

      sut.add(items);
      expect(sut.items.length).to.eq(3);

      const itemIds = items.map((item) => item.id);
      sut.remove(itemIds);
      expect(sut.items.length).to.eq(0);
    });

    it("add via load should not trigger listener", () => {
      const sut = new PluginStatusBarItemsManager();

      const items: CommonStatusBarItem[] = [
        AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello"),
        AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem2", StatusBarSection.Center, 100, "icon-developer", "test status bar from plugin", () => { }),
        createCustomItem("PluginTest:StatusBarItem3", StatusBarSection.Center, 100),
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.loadItems(items);
      spy.calledOnce.should.false;

      expect(sut.items.length).to.eq(3);
    });
  });

  describe("setIsVisible", () => {
    it("should set is visible", () => {
      const sut = new PluginStatusBarItemsManager();
      sut.items = [
        AbstractStatusBarItemUtilities.createLabelItem("test1", StatusBarSection.Center, 100, "icon-hand-2", "Hello"),
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.setIsVisible("test1", false);

      spy.calledOnce.should.true;
      sut.items[0].isVisible.should.false;
    });

    it("should not update if item is not found", () => {
      const sut = new PluginStatusBarItemsManager();
      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.setIsVisible("test1", false);

      spy.calledOnce.should.false;
    });

    it("should not update if item visibility equals new visibility", () => {
      const sut = new PluginStatusBarItemsManager();
      sut.items = [
        AbstractStatusBarItemUtilities.createLabelItem("test1", StatusBarSection.Center, 100, "icon-hand-2", "Hello"),
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.setIsVisible("test1", true);

      spy.calledOnce.should.false;
    });
  });

  describe("setLabel", () => {
    it("should set label on label item", () => {
      const sut = new PluginStatusBarItemsManager();
      sut.items = [
        AbstractStatusBarItemUtilities.createLabelItem("test1", StatusBarSection.Center, 100, "icon-hand-2", "Hello"),
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      const newLabel = "Goodbye";
      sut.setLabel("test1", newLabel);

      spy.calledOnce.should.true;
      const labelItem = sut.items[0];
      if (isAbstractStatusBarLabelItem(labelItem))
        expect(labelItem.label).to.be.eq(newLabel);
    });

    it("should set tooltip on action item", () => {
      const sut = new PluginStatusBarItemsManager();
      sut.items = [
        AbstractStatusBarItemUtilities.createActionItem("test1", StatusBarSection.Center, 100, "icon-developer", "test status bar from plugin", () => { }),
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      const newTip = "New Tip";
      sut.setTooltip("test1", newTip);

      spy.calledOnce.should.true;
      const actionItem = sut.items[0];
      if (isAbstractStatusBarActionItem(actionItem))
        expect(actionItem.tooltip).to.be.eq(newTip);
    });

    it("should not update if item is not found (Label)", () => {
      const sut = new PluginStatusBarItemsManager();
      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      const newLabel = "New Label";
      sut.setLabel("test1", newLabel);
      spy.calledOnce.should.false;
    });

    it("should not update if item is not found (Tooltip)", () => {
      const sut = new PluginStatusBarItemsManager();
      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      const newTip = "New Tip";
      sut.setTooltip("test1", newTip);
      spy.calledOnce.should.false;
    });

    it("should not update if label equals new label", () => {
      const sut = new PluginStatusBarItemsManager();
      const label = "Hello";

      sut.items = [
        AbstractStatusBarItemUtilities.createLabelItem("test1", StatusBarSection.Center, 100, "icon-hand-2", label),
      ];
      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.setLabel("test1", label);

      spy.calledOnce.should.false;
    });

    it("should not update if tooltip equals new tooltip", () => {
      const sut = new PluginStatusBarItemsManager();
      const toolTip = "ToolTip";

      sut.items = [
        AbstractStatusBarItemUtilities.createActionItem("test1", StatusBarSection.Center, 100, "icon-developer", toolTip, () => { }),
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.setTooltip("test1", toolTip);

      spy.calledOnce.should.false;
    });

  });
});
