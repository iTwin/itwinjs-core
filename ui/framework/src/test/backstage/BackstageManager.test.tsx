/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { BackstageManager, useIsBackstageOpen } from "../../ui-framework/backstage/BackstageManager";

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
  // tslint:disable-next-line:variable-name
  const TestHook = (props: { onRender: () => void }) => {
    props.onRender();
    return null;
  };

  it("should return is backstage open", () => {
    const spy = sinon.spy() as sinon.SinonSpy<[ReturnType<typeof useIsBackstageOpen>]>;
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
    const spy = sinon.spy() as sinon.SinonSpy<[ReturnType<typeof useIsBackstageOpen>]>;
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
