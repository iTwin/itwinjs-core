/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EmptyLocalization } from "@itwin/core-common";
import { MockRender } from "@itwin/core-frontend";
import { renderHook } from "@testing-library/react-hooks";
import { expect } from "chai";
import * as sinon from "sinon";
import { UiFramework } from "../../appui-react";
import { BackstageManager, useBackstageManager, useIsBackstageOpen } from "../../appui-react/backstage/BackstageManager";
import TestUtils from "../TestUtils";

describe("BackstageManager", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup({localization: new EmptyLocalization()});
  });
  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("should open backstage", () => {
    const manager = new BackstageManager();
    const spy = sinon.spy();
    manager.onToggled.addListener(spy);
    manager.open();
    // Check that we call only once;
    manager.open();

    expect(spy).to.have.been.calledOnceWith(sinon.match({ isOpen: true}));
    expect(manager.isOpen).to.be.true;

    manager.onToggled.removeListener(spy);
  });

  it("should close backstage", () => {
    const manager = new BackstageManager();
    const spy = sinon.spy();
    manager.open();
    manager.onToggled.addListener(spy);

    manager.close();

    expect(spy).to.have.been.calledWith(sinon.match({ isOpen: false}));
    expect(manager.isOpen).to.be.false;

    manager.onToggled.removeListener(spy);
  });

  it("should toggle backstage", () => {
    const manager = new BackstageManager();
    const spy = sinon.spy();
    manager.open();
    manager.onToggled.addListener(spy);

    manager.toggle();

    expect(spy).to.have.been.calledWith(sinon.match({ isOpen: false}));
    expect(manager.isOpen).to.be.false;

    spy.resetHistory();
    manager.toggle();

    expect(spy).to.have.been.calledWith(sinon.match({ isOpen: true}));
    expect(manager.isOpen).to.be.true;
    manager.onToggled.removeListener(spy);
  });

  it("should not trigger event if state do not change", () => {
    const manager = new BackstageManager();
    const spy = sinon.spy();
    manager.open();
    manager.onToggled.addListener(spy);
    manager.open();

    expect(spy).to.not.have.been.called;
    expect(manager.isOpen).to.be.true;
    manager.onToggled.removeListener(spy);
  });

  it("getBackstageToggleCommand generates toggle button", () => {
    const command = BackstageManager.getBackstageToggleCommand();
    const initialState = UiFramework.backstageManager.isOpen;
    command.execute();

    expect(UiFramework.backstageManager.isOpen).to.eq(!initialState);
  });

  it("getBackstageToggleCommand handles icon override", () => {
    const command = BackstageManager.getBackstageToggleCommand("different-icon");

    expect(command.iconSpec).to.eq("different-icon");
  });
});

describe("useIsBackstageOpen", () => {
  it("should return is backstage open", () => {
    const manager = new BackstageManager();

    const {result} = renderHook(() => useIsBackstageOpen(manager));

    expect(result.current).to.be.false;
  });

  it("should update isOpen", () => {
    const manager = new BackstageManager();
    const {result} = renderHook(() => useIsBackstageOpen(manager));

    manager.open();
    expect(result.current).to.be.true;
    manager.close();
    expect(result.current).to.be.false;
  });

  it("should remove onToggled listener", () => {
    const manager = new BackstageManager();
    const addSpy = sinon.spy(manager.onToggled, "addListener");
    const removeSpy = sinon.spy(manager.onToggled, "removeListener");
    const { unmount} = renderHook(() => useIsBackstageOpen(manager));
    const callback = sinon.spy(addSpy.firstCall, "returnValue");
    unmount();

    // Either one must be true for this test to pass
    expect([callback.called, removeSpy.calledWith(...addSpy.firstCall.args)]).to.include(true);
  });
});

describe("useBackstageManager", () => {
  it("returns UiFramework.backstageManager instance", async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup({localization: new EmptyLocalization()});

    const {result} = renderHook(() => useBackstageManager());
    expect(result.current).to.equal(UiFramework.backstageManager);

    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });
});
