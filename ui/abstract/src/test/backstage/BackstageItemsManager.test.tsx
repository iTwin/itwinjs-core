/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import {
  isActionItem,
  isStageLauncher,
  BackstageItemsManager,
  BackstageItemUtilities,
} from "../../ui-abstract";

// tslint:disable-next-line: completed-docs
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
    it("should raise onChanged event when new items are set", () => {
      const sut = new BackstageItemsManager();
      const spy = sinon.spy();
      sut.onChanged.addListener(spy);

      sut.items = [];

      spy.calledOnce.should.true;
    });

    it("should not raise onChanged event if items did not change", () => {
      const sut = new BackstageItemsManager();
      const spy = sinon.spy();

      const items: BackstageItemsManager["items"] = [];
      sut.items = items;

      sut.onChanged.addListener(spy);
      sut.items = items;

      spy.notCalled.should.true;
    });
  });

  describe("setIsVisible", () => {
    it("should set is visible", () => {
      const sut = new BackstageItemsManager();
      sut.items = [
        { ...getActionItem(), id: "0" },
      ];

      const spy = sinon.spy();
      sut.onChanged.addListener(spy);
      sut.setIsVisible("0", false);

      spy.calledOnce.should.true;
      sut.items[0].isVisible.should.false;
    });

    it("should not update if item is not found", () => {
      const sut = new BackstageItemsManager();
      const spy = sinon.spy();
      sut.onChanged.addListener(spy);
      sut.setIsVisible("0", false);

      spy.calledOnce.should.false;
    });

    it("should not update if item visibility equals new visibility", () => {
      const sut = new BackstageItemsManager();
      sut.items = [
        { ...getActionItem(), id: "0" },
      ];

      const spy = sinon.spy();
      sut.onChanged.addListener(spy);
      sut.setIsVisible("0", true);

      spy.calledOnce.should.false;
    });
  });

  describe("setIsEnabled", () => {
    it("should set is enabled", () => {
      const sut = new BackstageItemsManager();
      sut.items = [
        { ...getActionItem(), id: "0" },
      ];

      const spy = sinon.spy();
      sut.onChanged.addListener(spy);
      sut.setIsEnabled("0", false);

      spy.calledOnce.should.true;
      sut.items[0].isEnabled.should.false;
    });

    it("should not update if item is not found", () => {
      const sut = new BackstageItemsManager();
      const spy = sinon.spy();
      sut.onChanged.addListener(spy);
      sut.setIsEnabled("0", false);

      spy.calledOnce.should.false;
    });

    it("should not update if item isEnabled equals new isEnabled", () => {
      const sut = new BackstageItemsManager();
      sut.items = [
        { ...getActionItem(), id: "0" },
      ];

      const spy = sinon.spy();
      sut.onChanged.addListener(spy);
      sut.setIsEnabled("0", true);

      spy.calledOnce.should.false;
    });
  });

  describe("add", () => {
    it("should add single item", () => {
      const sut = new BackstageItemsManager();

      const spy = sinon.spy();
      sut.onChanged.addListener(spy);
      sut.add(getActionItem());

      spy.calledOnce.should.true;
      sut.items.length.should.eq(1);
    });

    it("should add multiple items", () => {
      const sut = new BackstageItemsManager();

      const spy = sinon.spy();
      sut.onChanged.addListener(spy);
      sut.add([getActionItem(), getStageLauncherItem()]);

      spy.calledOnce.should.true;
      sut.items.length.should.eq(2);
    });

    it("should not add multiple items with same id", () => {
      const sut = new BackstageItemsManager();

      const spy = sinon.spy();
      sut.onChanged.addListener(spy);
      sut.add([getActionItem(), getActionItem()]);

      spy.calledOnce.should.true;
      sut.items.length.should.eq(1);
    });

    it("should not add item that is already added", () => {
      const sut = new BackstageItemsManager();

      const spy = sinon.spy();
      sut.onChanged.addListener(spy);
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
      sut.onChanged.addListener(spy);
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
      sut.onChanged.addListener(spy);
      sut.remove(["a", "b"]);

      spy.calledOnce.should.true;
      sut.items.length.should.eq(0);
    });
  });
});
