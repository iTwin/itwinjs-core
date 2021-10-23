/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { BadgeType } from "@itwin/appui-abstract";
import { ActionItemButton, BaseItemState, CommandItemDef, KeyboardShortcutManager, SyncUiEventDispatcher } from "../../appui-react";
import { SyncUiEventId } from "../../appui-react/syncui/SyncUiEventDispatcher";
import TestUtils, { mount } from "../TestUtils";

describe("ActionItemButton", () => {

  let testCommand: CommandItemDef;

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  beforeEach(async () => {
    testCommand =
      new CommandItemDef({
        commandId: "command",
        iconSpec: "icon-placeholder",
        label: () => "tests.label",
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
    const myCommand = testCommand;
    myCommand.isVisible = false; // eslint-disable-line deprecation/deprecation
    shallow(<ActionItemButton actionItem={myCommand} />).should.matchSnapshot();
  });

  it("enabled renders correctly", () => {
    const myCommand = testCommand;
    myCommand.isEnabled = true; // eslint-disable-line deprecation/deprecation
    shallow(<ActionItemButton actionItem={myCommand} />).should.matchSnapshot();
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
  });

  it("should set focus to home on Esc", () => {
    const wrapper = mount(<ActionItemButton actionItem={testCommand} />);
    const element = wrapper.find(".nz-toolbar-item-item");
    element.length.should.eq(1);
    element.simulate("focus");
    element.simulate("keyDown", { key: "Escape" });
    expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;
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
  });

  it("should handle changing state via props", () => {
    const myCommand = testCommand;
    myCommand.isEnabled = true; // eslint-disable-line deprecation/deprecation
    const wrapper = mount(<ActionItemButton actionItem={myCommand} isEnabled={false} />);
    expect(wrapper.state("isEnabled")).to.be.false;
    wrapper.setProps({ isEnabled: true });
    expect(wrapper.state("isEnabled")).to.be.true;
  });
});

it("should render with badgeType", () => {
  const myCommand =
    new CommandItemDef({
      commandId: "command",
      iconSpec: "icon-placeholder",
      badgeType: BadgeType.New,
    });

  const wrapper = mount(<ActionItemButton actionItem={myCommand} />);
  const badge = wrapper.find("div.nz-badge");
  badge.length.should.eq(1);
  const newBadge = wrapper.find("div.core-new-badge");
  newBadge.length.should.eq(1);
});
