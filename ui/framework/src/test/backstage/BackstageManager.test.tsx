/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import sinon from "sinon";
import { BackstageManager, useIsBackstageOpen } from "../../ui-framework/backstage/BackstageManager.js";
import { mount } from "../TestUtils.js";

describe("BackstageManager", () => {
  describe("items", () => {
    it("should open backstage", () => {
      const sut = new BackstageManager();
      const spy = sinon.spy();
      sut.onToggled.addListener(spy);
      sut.open();

      spy.calledOnce.should.true;
    });
  });
});

describe("useIsBackstageOpen", () => {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const TestHook = (props: { onRender: () => void }) => {
    props.onRender();
    return null;
  };

  it("should return is backstage open", () => {
    const spy = sinon.stub<[ReturnType<typeof useIsBackstageOpen>]>();
    const manager = new BackstageManager();
    shallow(<TestHook
      onRender={() => spy(useIsBackstageOpen(manager))}
    />);

    spy.calledOnceWithExactly(false).should.true;
  });

  it("should add onToggled listener", () => {
    const manager = new BackstageManager();
    const spy = sinon.spy(manager.onToggled, "addListener");
    mount(<TestHook
      onRender={() => useIsBackstageOpen(manager)}
    />);

    spy.calledOnce.should.true;
  });

  it("should update isOpen", () => {
    const spy = sinon.stub<[ReturnType<typeof useIsBackstageOpen>]>();
    const manager = new BackstageManager();
    mount(<TestHook
      onRender={() => spy(useIsBackstageOpen(manager))}
    />);

    manager.open();
    spy.lastCall.calledWithExactly(true).should.true;
  });

  it("should remove onToggled listener", () => {
    const manager = new BackstageManager();
    const spy = sinon.spy(manager.onToggled, "removeListener");
    const sut = mount(<TestHook
      onRender={() => useIsBackstageOpen(manager)}
    />);
    sut.unmount();
    spy.calledOnce.should.true;
  });
});
