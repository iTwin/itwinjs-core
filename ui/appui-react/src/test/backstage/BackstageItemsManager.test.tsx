/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { BackstageItemsManager, isActionItem, isStageLauncher } from "@itwin/appui-abstract";
import { useDefaultBackstageItems } from "../../appui-react";
import { getActionItem, getStageLauncherItem } from "./BackstageComposerItem.test";
import { mount } from "../TestUtils";

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
        getActionItem({ id: "a" }),
        getStageLauncherItem({ id: "b" }),
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
        getActionItem({ id: "a" }),
        getStageLauncherItem({ id: "b" }),
      ];

      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);
      sut.remove(["a", "b"]);

      spy.calledOnce.should.true;
      sut.items.length.should.eq(0);
    });
  });
});

describe("useDefaultBackstageItems", () => {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const TestHook = (props: { onRender: () => void }) => {
    props.onRender();
    return null;
  };

  it("should return backstage items", () => {
    const spy = sinon.stub<[ReturnType<typeof useDefaultBackstageItems>]>();
    const manager = new BackstageItemsManager();
    manager.items = [
      getActionItem(),
    ];
    shallow(<TestHook
      onRender={() => spy(useDefaultBackstageItems(manager))}
    />);

    spy.calledOnceWithExactly(sinon.match([manager.items[0]])).should.true;
  });

  it("should add onItemsChanged listener", () => {
    const manager = new BackstageItemsManager();
    const spy = sinon.spy(manager.onItemsChanged, "addListener");
    manager.items = [
      getActionItem(),
    ];
    mount(<TestHook
      onRender={() => useDefaultBackstageItems(manager)}
    />);

    spy.calledOnce.should.true;
  });

  it("should update items", () => {
    const spy = sinon.stub<[ReturnType<typeof useDefaultBackstageItems>]>();
    const manager = new BackstageItemsManager();
    manager.items = [
      getActionItem(),
    ];
    mount(<TestHook
      onRender={() => spy(useDefaultBackstageItems(manager))}
    />);

    manager.items = [];

    spy.lastCall.calledWithExactly(sinon.match([])).should.true;
  });

  it("should remove onItemsChanged listener", () => {
    const manager = new BackstageItemsManager();
    const spy = sinon.spy(manager.onItemsChanged, "removeListener");
    manager.items = [
      getActionItem(),
    ];
    const wrapper = mount(<TestHook
      onRender={() => useDefaultBackstageItems(manager)}
    />);
    wrapper.unmount();
    spy.calledOnce.should.true;
  });

  describe("more useDefaultBackstageItems", () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const TestHook2 = (props: { mrg: BackstageItemsManager, onRender: (mrg: BackstageItemsManager) => void }) => {
      props.onRender(props.mrg);
      return null;
    };

    it("cover changing managers", () => {
      const manager = new BackstageItemsManager();
      manager.items = [
        getActionItem(),
      ];
      const sut = mount(<TestHook2 mrg={manager}
        onRender={(mrg: BackstageItemsManager) => useDefaultBackstageItems(mrg)}
      />);

      const manager2 = new BackstageItemsManager();
      manager2.items = [
        getActionItem({ id: "a" }),
        getStageLauncherItem({ id: "b" }),
      ];
      sut.setProps({ mrg: manager2 });
      sut.update();
    });
  });
});
