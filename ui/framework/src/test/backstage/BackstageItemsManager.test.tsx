/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import {
  isActionItem,
  isStageLauncher,
  BackstageItemsManager,
  useBackstageItems,
} from "../../ui-framework";
import { getActionItem, getStageLauncherItem } from "./BackstageComposerItem.test";

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
        getActionItem({ id: "0" }),
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
        getActionItem({ id: "0" }),
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
        getActionItem({ id: "0" }),
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
        getActionItem({ id: "0" }),
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
  });

  describe("remove", () => {
    it("should remove single item", () => {
      const sut = new BackstageItemsManager();
      sut.items = [
        getActionItem({ id: "a" }),
        getStageLauncherItem({ id: "b" }),
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
        getActionItem({ id: "a" }),
        getStageLauncherItem({ id: "b" }),
      ];

      const spy = sinon.spy();
      sut.onChanged.addListener(spy);
      sut.remove(["a", "b"]);

      spy.calledOnce.should.true;
      sut.items.length.should.eq(0);
    });
  });
});

describe("useBackstageItems", () => {
  // tslint:disable-next-line:variable-name
  const TestHook = (props: { onRender: () => void }) => {
    props.onRender();
    return null;
  };

  it("should return backstage items", () => {
    const spy = sinon.spy() as sinon.SinonSpy<[ReturnType<typeof useBackstageItems>]>;
    const manager = new BackstageItemsManager();
    manager.items = [
      getActionItem(),
    ];
    shallow(<TestHook
      onRender={() => spy(useBackstageItems(manager))}  // tslint:disable-line: react-hooks-nesting
    />);

    spy.calledOnceWithExactly(sinon.match([manager.items[0]]) as any).should.true;
  });

  it("should add onChanged listener", () => {
    const manager = new BackstageItemsManager();
    const spy = sinon.spy(manager.onChanged, "addListener");
    manager.items = [
      getActionItem(),
    ];
    mount(<TestHook
      onRender={() => useBackstageItems(manager)} // tslint:disable-line: react-hooks-nesting
    />);

    spy.calledOnce.should.true;
  });

  it("should update items", () => {
    const spy = sinon.spy() as sinon.SinonSpy<[ReturnType<typeof useBackstageItems>]>;
    const manager = new BackstageItemsManager();
    manager.items = [
      getActionItem(),
    ];
    mount(<TestHook
      onRender={() => spy(useBackstageItems(manager))}  // tslint:disable-line: react-hooks-nesting
    />);

    manager.items = [];

    spy.lastCall.calledWithExactly(sinon.match([]) as any).should.true;
  });

  it("should remove onChanged listener", () => {
    const manager = new BackstageItemsManager();
    const spy = sinon.spy(manager.onChanged, "removeListener");
    manager.items = [
      getActionItem(),
    ];
    const sut = mount(<TestHook
      onRender={() => useBackstageItems(manager)} // tslint:disable-line: react-hooks-nesting
    />);
    sut.unmount();

    spy.calledOnce.should.true;
  });
});
