/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import {
  ActionItemButton,
  CommandItemDef,
  KeyboardShortcutManager,
  BaseItemState, SyncUiEventDispatcher,
} from "../../ui-framework";
import TestUtils from "../TestUtils";
import { SyncUiEventId } from "../../ui-framework/syncui/SyncUiEventDispatcher";

describe("ActionItemButton", () => {

  let testCommand: CommandItemDef;

  before(async () => {
    await TestUtils.initializeUiFramework();

    testCommand =
      new CommandItemDef({
        commandId: "command",
        iconSpec: "icon-placeholder",
        labelKey: "UiFramework:tests.label",
        isEnabled: false,
        execute: () => { },
      });
  });

  it("should render", () => {
    mount(<ActionItemButton actionItem={testCommand} />);
  });

  it("renders correctly", () => {
    shallow(<ActionItemButton actionItem={testCommand} />).should.matchSnapshot();
  });

  it("hidden renders correctly", () => {
    shallow(<ActionItemButton actionItem={testCommand} />).should.matchSnapshot();
  });

  it("disabled renders correctly", () => {
    shallow(<ActionItemButton actionItem={testCommand} />).should.matchSnapshot();
  });

  it("should execute a function", () => {
    const spyMethod = sinon.spy();
    const spyCommand =
      new CommandItemDef({
        commandId: "command",
        iconSpec: "icon-placeholder",
        labelKey: "UiFramework:tests.label",
        execute: spyMethod,
      });

    const wrapper = mount(<ActionItemButton actionItem={spyCommand} />);
    wrapper.find(".nz-toolbar-item-item").simulate("click");
    spyMethod.should.have.been.called;
    wrapper.unmount();
  });

  it("should set focus to home on Esc", () => {
    const wrapper = mount(<ActionItemButton actionItem={testCommand} />);
    const element = wrapper.find(".nz-toolbar-item-item");
    element.simulate("focus");
    element.simulate("keyDown", { key: "Escape", keyCode: 27 });
    expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;
    wrapper.unmount();
  });

  it("sync event should trigger stateFunc", () => {
    const states: BaseItemState[] = [{ isVisible: true, isActive: false }, { isVisible: false, isActive: false }, { isVisible: true, isActive: true }];
    let count = -1;
    const testEventId = "test-button-state";
    let stateFunctionCalled = false;
    const testStateFunc = (): BaseItemState => { count += 1; stateFunctionCalled = true; return states[count]; };
    const testSyncStateCommand =
      new CommandItemDef({
        commandId: "command",
        iconSpec: "icon-placeholder",
        labelKey: "UiFramework:tests.label",
        isEnabled: false,
        stateSyncIds: [testEventId],
        stateFunc: testStateFunc,
        execute: () => { },
      });

    const wrapper = mount(<ActionItemButton actionItem={testSyncStateCommand} />);
    expect(stateFunctionCalled).to.eq(false);
    // force to state[0]
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
    expect(stateFunctionCalled).to.eq(true);
    wrapper.update();
    // force to state[1]
    stateFunctionCalled = false;
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
    expect(stateFunctionCalled).to.eq(true);
    wrapper.update();
    // force to state[2]
    stateFunctionCalled = false;
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
    expect(stateFunctionCalled).to.eq(true);
    wrapper.update();
    wrapper.unmount();
  });

  it("ToolActivated sync event should trigger stateFunc", () => {
    const state: BaseItemState = { isVisible: true, isActive: true, isEnabled: true };
    const testEventId = SyncUiEventId.ToolActivated;
    let stateFunctionCalled = false;
    const testStateFunc = (): BaseItemState => { stateFunctionCalled = true; return state; };
    const testSyncStateCommand =
      new CommandItemDef({
        commandId: "command",
        iconSpec: "icon-placeholder",
        labelKey: "UiFramework:tests.label",
        isEnabled: false,
        stateSyncIds: [testEventId],
        stateFunc: testStateFunc,
        execute: () => { },
      });

    const wrapper = mount(<ActionItemButton actionItem={testSyncStateCommand} />);
    expect(stateFunctionCalled).to.eq(false);
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
    expect(stateFunctionCalled).to.eq(true);
    wrapper.update();
    wrapper.unmount();
  });

  it("should handle changing state via props", () => {
    const myCommand = testCommand;
    myCommand.isEnabled = true;
    const wrapper = mount(<ActionItemButton actionItem={myCommand} isEnabled={false} />);
    expect(wrapper.state("isEnabled")).to.be.false;
    wrapper.setProps({ isEnabled: true });
    expect(wrapper.state("isEnabled")).to.be.true;
  });
});
