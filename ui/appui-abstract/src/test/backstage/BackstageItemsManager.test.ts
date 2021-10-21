/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import {
  BackstageItemsManager, BackstageItemUtilities, ConditionalBooleanValue, ConditionalStringValue, isActionItem, isStageLauncher,
} from "../../appui-abstract";

const getActionItem = () => BackstageItemUtilities.createActionItem("Action", 100, 50, () => { }, "Custom Label", "subtitle", "icon-placeholder");
const getStageLauncherItem = () => BackstageItemUtilities.createStageLauncher("stageId", 100, 50, "Custom Label", "subtitle", "icon-placeholder");

describe("isActionItem", () => {
  it("should return true for ActionItem", () => {
    isActionItem(getActionItem()).should.true;
  });
});

describe("isStageLauncher", () => {
  it("should return true for StageLauncher", () => {
    isStageLauncher(getStageLauncherItem()).should.true;
  });
});

describe("BackstageItemsManager", () => {
  describe("items", () => {
    it("should raise onItemsChanged event when new items are set", () => {
      const sut = new BackstageItemsManager();
      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);

      sut.items = [];

      spy.calledOnce.should.true;
    });

    it("should not raise onItemsChanged event if items did not change", () => {
      const sut = new BackstageItemsManager();
      const spy = sinon.spy();

      const items: BackstageItemsManager["items"] = [];
      sut.items = items;

      sut.onItemsChanged.addListener(spy);
      sut.items = items;

      spy.notCalled.should.true;
    });
  });

  describe("add", () => {
    it("should instantiate with item", () => {
      const sut = new BackstageItemsManager([getActionItem()]);
      sut.items.length.should.eq(1);
    });

    it("should add item without callback", () => {
      const sut = new BackstageItemsManager();

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.loadItems([getActionItem()]);

      spy.calledOnce.should.false;
      sut.items.length.should.eq(1);
    });

    it("should add single item", () => {
      const sut = new BackstageItemsManager();

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.add(getActionItem());

      spy.calledOnce.should.true;
      sut.items.length.should.eq(1);
    });

    it("should add multiple items", () => {
      const sut = new BackstageItemsManager();

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.add([getActionItem(), getStageLauncherItem()]);

      spy.calledOnce.should.true;
      sut.items.length.should.eq(2);
    });

    it("should not add multiple items with same id", () => {
      const sut = new BackstageItemsManager();

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.add([getActionItem(), getActionItem()]);

      spy.calledOnce.should.true;
      sut.items.length.should.eq(1);
    });

    it("should not add item that is already added", () => {
      const sut = new BackstageItemsManager();

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.add(getActionItem());
      sut.add(getActionItem());

      spy.calledOnce.should.true;
      sut.items.length.should.eq(1);
    });
  });

  describe("remove", () => {
    it("should remove single item", () => {
      const sut = new BackstageItemsManager();
      sut.items = [
        { ...getActionItem(), id: "a" },
        { ...getStageLauncherItem(), id: "b" },
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.remove("a");

      spy.calledOnce.should.true;
      sut.items.length.should.eq(1);
      sut.items[0].id.should.eq("b");
    });

    it("should remove multiple items", () => {
      const sut = new BackstageItemsManager();
      sut.items = [
        { ...getActionItem(), id: "a" },
        { ...getStageLauncherItem(), id: "b" },
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.remove(["a", "b"]);

      spy.calledOnce.should.true;
      sut.items.length.should.eq(0);
    });
  });

  describe("uisync", () => {
    it("uisync", () => {
      let isVisible = true;
      let isEnabled = true;
      const setVisibility = (value: boolean) => { isVisible = value; };
      const setEnabled = (value: boolean) => { isEnabled = value; };
      const syncId = "test-on-display-changed";
      const hiddenCondition = new ConditionalBooleanValue(() => !isVisible, [syncId]);
      const disabledCondition = new ConditionalBooleanValue(() => !isEnabled, [syncId]);
      const conditionalLabel = new ConditionalStringValue(() => isVisible ? "Hello" : "Goodbye", [syncId]);
      const conditionalIcon = new ConditionalStringValue(() => isVisible ? "icon-hand-2" : "icon-hand", [syncId]);
      const subTitleConditional = new ConditionalStringValue(() => isVisible ? "default subtitle" : "new subtitle", [syncId]);

      const getActionItemWithNoConditions = () => BackstageItemUtilities.createActionItem("Action-NC", 100, 50, () => { }, "Custom Label", "subtitle", "icon-placeholder");  // try to init isVisible to false but this should be reset when loaded due to condition function
      const getActionItemWithConditions = () => BackstageItemUtilities.createActionItem("Action-C", 100, 50, () => { }, conditionalLabel, subTitleConditional, conditionalIcon,
        { isHidden: hiddenCondition });  // try to init isVisible to false but this should be reset when loaded due to condition function
      const getStageLauncherItemWithNoConditions = () => BackstageItemUtilities.createStageLauncher("stageId-NC", 100, 50, "Custom Label", "subtitle", "icon-placeholder");
      const getStageLauncherItemWithConditions = () => BackstageItemUtilities.createStageLauncher("stageId-C", 100, 50, conditionalLabel, subTitleConditional, conditionalIcon,
        { isDisabled: disabledCondition });

      const sut = new BackstageItemsManager();

      sut.add([getActionItemWithNoConditions(), getActionItemWithConditions(), getStageLauncherItemWithNoConditions(), getStageLauncherItemWithConditions()]);

      const syncIds = BackstageItemsManager.getSyncIdsOfInterest(sut.items);
      expect(syncIds.length).to.be.eq(1);
      expect(syncIds[0]).to.be.eq(syncId);

      let actionItem = sut.items.find((i) => i.id === "Action-C");
      expect(ConditionalBooleanValue.getValue(actionItem!.isHidden)).to.be.false;
      expect(ConditionalStringValue.getValue(actionItem!.label)).to.be.equal("Hello");
      expect(ConditionalStringValue.getValue(actionItem!.icon)).to.be.equal("icon-hand-2");
      expect(ConditionalStringValue.getValue(actionItem!.subtitle)).to.be.equal("default subtitle");

      let stageItem = sut.items.find((i) => i.id === "stageId-C");
      expect(ConditionalBooleanValue.getValue(actionItem!.isDisabled)).to.be.false;
      expect(ConditionalBooleanValue.getValue(actionItem!.isHidden)).to.be.false;
      expect(ConditionalStringValue.getValue(stageItem!.label)).to.be.equal("Hello");
      expect(ConditionalStringValue.getValue(stageItem!.icon)).to.be.equal("icon-hand-2");
      expect(ConditionalStringValue.getValue(stageItem!.subtitle)).to.be.equal("default subtitle");

      let ncActionItem = sut.items.find((i) => i.id === "Action-NC");
      expect(ConditionalBooleanValue.getValue(ncActionItem!.isHidden)).to.be.false;
      let ncStageItem = sut.items.find((i) => i.id === "stageId-NC");
      expect(ConditionalBooleanValue.getValue(ncStageItem!.isDisabled)).to.be.false;

      setVisibility(false);
      setEnabled(false);
      const syncIdSet = new Set<string>([syncId]);
      sut.refreshAffectedItems(syncIdSet);

      actionItem = sut.items.find((i) => i.id === "Action-C");
      expect(ConditionalBooleanValue.getValue(actionItem!.isHidden)).to.be.true;
      stageItem = sut.items.find((i) => i.id === "stageId-C");
      expect(ConditionalBooleanValue.getValue(stageItem!.isDisabled)).to.be.true;
      ncActionItem = sut.items.find((i) => i.id === "Action-NC");
      expect(ConditionalBooleanValue.getValue(ncActionItem!.isHidden)).to.be.false;
      ncStageItem = sut.items.find((i) => i.id === "stageId-NC");
      expect(ConditionalBooleanValue.getValue(ncStageItem!.isDisabled)).to.be.false;

      expect(ConditionalStringValue.getValue(actionItem!.label)).to.be.equal("Goodbye");
      expect(ConditionalStringValue.getValue(actionItem!.icon)).to.be.equal("icon-hand");
      expect(ConditionalStringValue.getValue(actionItem!.subtitle)).to.be.equal("new subtitle");
      expect(ConditionalStringValue.getValue(stageItem!.label)).to.be.equal("Goodbye");
      expect(ConditionalStringValue.getValue(stageItem!.icon)).to.be.equal("icon-hand");
      expect(ConditionalStringValue.getValue(stageItem!.subtitle)).to.be.equal("new subtitle");
    });

    it("should convert SyncEventIds to lowercase", () => {
      const isHidden = new ConditionalBooleanValue(() => true, ["Test:CustomId"]);
      const action = BackstageItemUtilities.createActionItem("TestAction", 100, 50, () => { }, "", undefined, undefined, { isHidden });
      const sut = new BackstageItemsManager();
      sut.add(action);
      const syncIds = BackstageItemsManager.getSyncIdsOfInterest(sut.items);
      syncIds.should.eql(["test:customid"]);
    });
  });
});
