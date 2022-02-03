/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import type { CommonToolbarItem, CustomButtonDefinition} from "../../appui-abstract";
import {
  BadgeType, ConditionalBooleanValue, ConditionalStringValue, ToolbarItemsManager, ToolbarItemUtilities,
} from "../../appui-abstract";

describe("ToolbarItemsManager", () => {

  const customSpec: CustomButtonDefinition = {
    id: "custom", itemPriority: 1,
    isCustom: true,
  };

  let isChildVisible = true;
  let isVisible = true;
  let isEnabled = true;
  const setChildVisibility = (value: boolean) => { isChildVisible = value; };
  const setVisibility = (value: boolean) => { isVisible = value; };
  const setEnabled = (value: boolean) => { isEnabled = value; };
  const syncId = "test-on-display-changed";
  const childSyncId = "child-test-on-display-changed";
  const hiddenCondition = () => new ConditionalBooleanValue(() => !isVisible, [syncId]);
  const childHiddenCondition = () => new ConditionalBooleanValue(() => !isChildVisible, [childSyncId]);
  const nestChildHiddenCondition = () => new ConditionalBooleanValue(() => !isChildVisible, [childSyncId]);
  const disabledCondition = () => new ConditionalBooleanValue(() => !isEnabled, [syncId]);
  const conditionalLabel = new ConditionalStringValue(() => isVisible ? "Hello" : "Goodbye", [syncId]);
  const conditionalIcon = new ConditionalStringValue(() => isVisible ? "icon-developer" : "icon-home", [syncId]);
  const nestedConditionalLabel = new ConditionalStringValue(() => isVisible ? "nested-Hello" : "nested-Goodbye", [syncId]);
  const nestedConditionalIcon = new ConditionalStringValue(() => isVisible ? "nested-icon-developer" : "nested-icon-home", [syncId]);

  const simpleActionSpec = ToolbarItemUtilities.createActionButton("simple-test-action1-tool", 100, "icon-developer", "simple-test-action-tool", (): void => { });
  const simpleAction2Spec = ToolbarItemUtilities.createActionButton("simple-test-action2-tool", 100, conditionalIcon, conditionalLabel, (): void => { }, { isHidden: hiddenCondition() });
  const child1ActionSpec = ToolbarItemUtilities.createActionButton("child1-test-action-tool", 100, "icon-developer", "child1", (): void => { }, { isHidden: childHiddenCondition() });
  const child2ActionSpec = ToolbarItemUtilities.createActionButton("child2-test-action-tool", 110, conditionalIcon, conditionalLabel, (): void => { }, { isDisabled: disabledCondition() });
  const nestedChild1ActionSpec = ToolbarItemUtilities.createActionButton("child1-test-action-tool-nested", 100, "icon-developer", "child1", (): void => { }, { isHidden: nestChildHiddenCondition() });
  const nestedChild2ActionSpec = ToolbarItemUtilities.createActionButton("child2-test-action-tool-nested", 110, nestedConditionalIcon, nestedConditionalLabel, (): void => { }, { isDisabled: disabledCondition() });
  const nestedGroupItem = ToolbarItemUtilities.createGroupButton("tool-formatting-setting-nested", 110, "icon-placeholder", "set formatting units", [nestedChild1ActionSpec, nestedChild2ActionSpec], { badgeType: BadgeType.New });
  const groupItem = ToolbarItemUtilities.createGroupButton("tool-formatting-setting", 110, "icon-placeholder", "set formatting units", [child1ActionSpec, child2ActionSpec, nestedGroupItem], { badgeType: BadgeType.New, isDisabled: disabledCondition() });

  afterEach(() => sinon.restore());

  describe("items", () => {
    it("should contain 0 items by default", () => {
      const sut = new ToolbarItemsManager();
      expect(sut.items.length).to.eq(0);
    });
  });

  describe("type guards", () => {
    it("should evaluate types properly", () => {
      expect(ToolbarItemUtilities.isActionButton(simpleActionSpec)).to.be.true;
      expect(ToolbarItemUtilities.isGroupButton(groupItem)).to.be.true;
    });

    it("should identify action item", () => {
      expect(ToolbarItemUtilities.isActionButton(simpleActionSpec)).to.be.true;
      expect(ToolbarItemUtilities.isGroupButton(simpleActionSpec)).to.be.false;
      expect(ToolbarItemUtilities.isCustomDefinition(simpleActionSpec)).to.be.false;
    });

    it("should identify custom item", () => {
      expect(ToolbarItemUtilities.isActionButton(customSpec)).to.be.false;
      expect(ToolbarItemUtilities.isGroupButton(customSpec)).to.be.false;
      expect(ToolbarItemUtilities.isCustomDefinition(customSpec)).to.be.true;
    });
  });

  describe("add & remove", () => {
    it("should instantiate with item", () => {
      const sut = new ToolbarItemsManager([simpleActionSpec]);
      sut.items.length.should.eq(1);
    });

    it("should add item without callback", () => {
      const sut = new ToolbarItemsManager();

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.loadItems([simpleActionSpec]);

      spy.calledOnce.should.false;
      sut.items.length.should.eq(1);
    });

    it("should add & remove one item", () => {
      const sut = new ToolbarItemsManager();

      sut.add(simpleActionSpec);
      expect(sut.items.length).to.eq(1);

      sut.remove(simpleActionSpec.id);
      expect(sut.items.length).to.eq(0);
    });

    it("attempt to set duplicate items ignores it", () => {
      const sut = new ToolbarItemsManager();

      sut.add(simpleActionSpec);
      expect(sut.items.length).to.eq(1);

      sut.items = sut.items;
      expect(sut.items.length).to.eq(1);
    });

    it("add ignores duplicate items", () => {
      const sut = new ToolbarItemsManager();

      sut.add([simpleActionSpec, simpleActionSpec]);
      sut.items.length.should.eq(1);
    });

    it("attempt to add duplicate item ignores it", () => {
      const sut = new ToolbarItemsManager();

      sut.add(simpleActionSpec);
      expect(sut.items.length).to.eq(1);

      sut.add(simpleActionSpec);
      expect(sut.items.length).to.eq(1);
    });

    it("should add & remove multiple items to ToolbarManager items", () => {
      const sut = new ToolbarItemsManager();

      const items: CommonToolbarItem[] = [simpleActionSpec, groupItem];

      sut.add(items);
      expect(sut.items.length).to.eq(2);

      const itemIds = items.map((item) => item.id);
      sut.remove(itemIds);
      expect(sut.items.length).to.eq(0);
    });

    it("add via load should not trigger listener", () => {
      const sut = new ToolbarItemsManager();

      const items: CommonToolbarItem[] = [simpleActionSpec, groupItem, customSpec];

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
    const sut = new ToolbarItemsManager([simpleActionSpec, simpleAction2Spec, groupItem]);
    const syncIds = ToolbarItemsManager.getSyncIdsOfInterest(sut.items);
    expect(syncIds.length).to.be.eq(2);
    expect(syncIds[0]).to.be.eq(syncId);
    expect(syncIds[1]).to.be.eq(childSyncId);

    let locatedAction2Item = sut.items.find((i) => i.id === simpleAction2Spec.id);
    if (ToolbarItemUtilities.isActionButton(locatedAction2Item!)) {
      expect(ConditionalStringValue.getValue(locatedAction2Item.label)).to.be.equal("Hello");
      expect(ConditionalStringValue.getValue(locatedAction2Item.icon)).to.be.equal("icon-developer");
    } else {
      throw new Error(`Error locating Action2`);
    }

    let locatedGroupItem = sut.items.find((i) => i.id === groupItem.id);
    if (ToolbarItemUtilities.isGroupButton(locatedGroupItem!)) {
      expect(ConditionalBooleanValue.getValue(locatedGroupItem.items[0].isHidden)).to.be.false;
      expect(ConditionalBooleanValue.getValue(locatedGroupItem.items[1].isDisabled)).to.be.false;
    } else {
      throw new Error(`Error locating group`);
    }

    setVisibility(false);
    setEnabled(false);
    const syncIdSet = new Set<string>([syncId]);
    sut.refreshAffectedItems(syncIdSet);
    setChildVisibility(false);
    sut.refreshAffectedItems(new Set<string>([childSyncId]));

    locatedAction2Item = sut.items.find((i) => i.id === simpleAction2Spec.id);
    if (ToolbarItemUtilities.isActionButton(locatedAction2Item!)) {
      expect(ConditionalStringValue.getValue(locatedAction2Item.label)).to.be.equal("Goodbye");
      expect(ConditionalStringValue.getValue(locatedAction2Item.icon)).to.be.equal("icon-home");
    } else {
      throw new Error(`Error locating Action2`);
    }

    locatedGroupItem = sut.items.find((i) => i.id === groupItem.id);
    if (ToolbarItemUtilities.isGroupButton(locatedGroupItem!)) {
      expect(ConditionalBooleanValue.getValue(locatedGroupItem.items[0].isHidden)).to.be.true;
      expect(ConditionalBooleanValue.getValue(locatedGroupItem.items[1].isDisabled)).to.be.true;
    } else {
      throw new Error(`Error locating group`);
    }
  });

  describe("set active tool", () => {
    it("root tool already active", () => {
      const initiallyActiveSpec = ToolbarItemUtilities.createActionButton("simple-test-action-tool-active", 100, "icon-developer", "simple-test-action-tool", (): void => { }, { isActive: true });
      const sut = new ToolbarItemsManager([simpleActionSpec, simpleAction2Spec, groupItem, initiallyActiveSpec]);

      const items = sut.items;
      sut.setActiveToolId("simple-test-action-tool-active");
      expect(items).to.equal(sut.items);
    });

    it("misc tools activate properly", () => {
      const sut = new ToolbarItemsManager([simpleActionSpec, simpleAction2Spec, groupItem]);

      let items = sut.items;
      sut.setActiveToolId(nestedChild1ActionSpec.id);
      expect(items).not.to.equal(sut.items);

      items = sut.items;
      sut.setActiveToolId(nestedChild2ActionSpec.id);
      expect(items).not.to.equal(sut.items);

      items = sut.items;
      sut.setActiveToolId(simpleActionSpec.id);
      expect(items).not.to.equal(sut.items);
    });
  });

});
