/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import type {
  AbstractStatusBarCustomItem, CommonStatusBarItem} from "../../appui-abstract";
import { AbstractStatusBarItemUtilities, ConditionalBooleanValue, ConditionalStringValue,
  isAbstractStatusBarActionItem, isAbstractStatusBarCustomItem, isAbstractStatusBarLabelItem, StatusBarItemsManager, StatusBarSection,
} from "../../appui-abstract";

describe("StatusBarItemsManager", () => {
  const createCustomItem = (id: string, section: StatusBarSection, itemPriority: number, itemProps?: Partial<AbstractStatusBarCustomItem>): AbstractStatusBarCustomItem => ({
    id, section, itemPriority,
    isCustom: true,
    ...itemProps ? itemProps : {},
  });

  afterEach(() => sinon.restore());

  describe("items", () => {
    it("should contain 0 items by default", () => {
      const sut = new StatusBarItemsManager();
      expect(sut.items.length).to.eq(0);
    });
  });

  describe("type guards", () => {
    it("should identify label item", () => {
      const item = AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello", undefined, { isDisabled: true, isHidden: true });
      expect(isAbstractStatusBarLabelItem(item)).to.be.true;
      expect(isAbstractStatusBarActionItem(item)).to.be.false;
      expect(isAbstractStatusBarCustomItem(item)).to.be.false;
      expect(ConditionalBooleanValue.getValue(item.isDisabled)).to.be.true;
      expect(ConditionalBooleanValue.getValue(item.isHidden)).to.be.true;
    });

    it("should identify action item", () => {
      const item = AbstractStatusBarItemUtilities.createActionItem("ExtensionTest:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "test status bar from extension", () => { });
      expect(isAbstractStatusBarActionItem(item)).to.be.true;
      expect(isAbstractStatusBarLabelItem(item)).to.be.false;
      expect(isAbstractStatusBarCustomItem(item)).to.be.false;
    });

    it("should identify custom item", () => {
      const item = createCustomItem("ExtensionTest:StatusBarItem1", StatusBarSection.Center, 100);
      expect(isAbstractStatusBarCustomItem(item)).to.be.true;
      expect(isAbstractStatusBarActionItem(item)).to.be.false;
      expect(isAbstractStatusBarLabelItem(item)).to.be.false;
    });
  });

  describe("add & remove", () => {
    it("should instantiate with item", () => {
      const item = AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");
      const sut = new StatusBarItemsManager([item]);
      sut.items.length.should.eq(1);
    });

    it("should add item without callback", () => {
      const item = AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");
      const sut = new StatusBarItemsManager();

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.loadItems([item]);

      spy.calledOnce.should.false;
      sut.items.length.should.eq(1);
    });

    it("should add & remove one item", () => {
      const sut = new StatusBarItemsManager();

      const item = AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");
      expect(isAbstractStatusBarLabelItem(item)).to.be.true;
      expect(isAbstractStatusBarActionItem(item)).to.be.false;

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.remove(item.id);
      expect(sut.items.length).to.eq(0);
    });

    it("attempt to set duplicate items ignores it", () => {
      const sut = new StatusBarItemsManager();

      const item = AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.items = sut.items;
      expect(sut.items.length).to.eq(1);
    });

    it("add ignores duplicate items", () => {
      const sut = new StatusBarItemsManager();

      const item1 = AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");
      const item2 = AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");
      sut.add([item1, item2]);
      sut.items.length.should.eq(1);
    });

    it("attempt to add duplicate item ignores it", () => {
      const sut = new StatusBarItemsManager();

      const item = AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello");

      sut.add(item);
      expect(sut.items.length).to.eq(1);

      sut.add(item);
      expect(sut.items.length).to.eq(1);
    });

    it("should add & remove multiple items to StatusBarManager items", () => {
      const sut = new StatusBarItemsManager();

      const items: CommonStatusBarItem[] = [
        AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello"),
        AbstractStatusBarItemUtilities.createActionItem("ExtensionTest:StatusBarItem2", StatusBarSection.Center, 100, "icon-developer", "test status bar from extension", () => { }),
        createCustomItem("ExtensionTest:StatusBarItem3", StatusBarSection.Center, 100),
      ];

      sut.add(items);
      expect(sut.items.length).to.eq(3);

      const itemIds = items.map((item) => item.id);
      sut.remove(itemIds);
      expect(sut.items.length).to.eq(0);
    });

    it("add via load should not trigger listener", () => {
      const sut = new StatusBarItemsManager();

      const items: CommonStatusBarItem[] = [
        AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello"),
        AbstractStatusBarItemUtilities.createActionItem("ExtensionTest:StatusBarItem2", StatusBarSection.Center, 100, "icon-developer", "test status bar from extension", () => { }),
        createCustomItem("ExtensionTest:StatusBarItem3", StatusBarSection.Center, 100),
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.loadItems(items);
      spy.calledOnce.should.false;

      expect(sut.items.length).to.eq(3);

      spy.resetHistory();
      sut.removeAll();
      spy.calledOnce.should.false;
      expect(sut.items.length).to.eq(0);
    });
  });

  describe("uisync", () => {
    let isVisible = true;
    let isEnabled = true;
    const setVisibility = (value: boolean) => { isVisible = value; };
    const setEnabled = (value: boolean) => { isEnabled = value; };
    const syncId = "test-on-display-changed";
    const hiddenCondition = new ConditionalBooleanValue(() => !isVisible, [syncId]);
    const disabledCondition = new ConditionalBooleanValue(() => !isEnabled, [syncId]);
    const conditionalLabel = new ConditionalStringValue(() => isVisible ? "Hello" : "Goodbye", [syncId]);
    const conditionalIcon = new ConditionalStringValue(() => isVisible ? "icon-hand-2" : "icon-hand", [syncId]);
    const toolTipConditional = new ConditionalStringValue(() => isVisible ? "default tooltip" : "new tooltip", [syncId]);

    const sut = new StatusBarItemsManager();

    const item1 = AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", conditionalLabel, undefined,
      { isHidden: hiddenCondition });  // try to init isVisible to false but this should be reset when loaded due to condition function
    const item2 = AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel2", StatusBarSection.Center, 110, conditionalIcon, "Hello", undefined,
      { isDisabled: disabledCondition });
    const sb3 = AbstractStatusBarItemUtilities.createActionItem("ExtensionTest:StatusBarItem3", StatusBarSection.Center, 120, "icon-developer", toolTipConditional, () => { });

    sut.add([item1, item2, sb3]);

    const syncIds = StatusBarItemsManager.getSyncIdsOfInterest(sut.items);
    expect(syncIds.length).to.be.eq(1);
    expect(syncIds[0]).to.be.eq(syncId);

    let actionItem = sut.items.find((i) => i.id === "ExtensionTest:StatusBarLabel1");
    expect(ConditionalBooleanValue.getValue(actionItem!.isHidden)).to.be.false;
    expect(isAbstractStatusBarLabelItem(actionItem!)).to.be.true;
    if (isAbstractStatusBarLabelItem(actionItem!)) {
      expect(ConditionalStringValue.getValue(actionItem.label)).to.be.equal("Hello");
    }
    let stageItem = sut.items.find((i) => i.id === "ExtensionTest:StatusBarLabel2");
    expect(ConditionalBooleanValue.getValue(stageItem!.isDisabled)).to.be.false;
    if (isAbstractStatusBarLabelItem(stageItem!)) {
      expect(ConditionalStringValue.getValue(stageItem.icon)).to.be.equal("icon-hand-2");
    }
    let item3 = sut.items.find((i) => i.id === "ExtensionTest:StatusBarItem3");
    expect(ConditionalBooleanValue.getValue(item3!.isDisabled)).to.be.false;
    if (isAbstractStatusBarActionItem(item3!)) {
      expect(ConditionalStringValue.getValue(item3.tooltip)).to.be.equal("default tooltip");
    }

    setVisibility(false);
    setEnabled(false);
    const syncIdSet = new Set<string>([syncId]);
    sut.refreshAffectedItems(syncIdSet);

    actionItem = sut.items.find((i) => i.id === "ExtensionTest:StatusBarLabel1");
    expect(ConditionalBooleanValue.getValue(actionItem!.isHidden)).to.be.true;
    expect(isAbstractStatusBarLabelItem(actionItem!)).to.be.true;
    if (isAbstractStatusBarLabelItem(actionItem!)) {
      expect(ConditionalStringValue.getValue(actionItem.label)).to.be.equal("Goodbye");
    }

    stageItem = sut.items.find((i) => i.id === "ExtensionTest:StatusBarLabel2");
    expect(ConditionalBooleanValue.getValue(stageItem!.isDisabled)).to.be.true;
    expect(isAbstractStatusBarLabelItem(stageItem!)).to.be.true;
    if (isAbstractStatusBarLabelItem(stageItem!)) {
      expect(ConditionalStringValue.getValue(stageItem.icon)).to.be.equal("icon-hand");
    }

    item3 = sut.items.find((i) => i.id === "ExtensionTest:StatusBarItem3");
    expect(ConditionalBooleanValue.getValue(item3!.isDisabled)).to.be.false;
    if (isAbstractStatusBarActionItem(item3!)) {
      expect(ConditionalStringValue.getValue(item3.tooltip)).to.be.equal("new tooltip");
    }

  });

});
