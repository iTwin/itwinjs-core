/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { SelectionTool } from "@itwin/core-frontend";
import { BadgeType } from "@itwin/appui-abstract";
import { BaseItemState, FrontstageManager, KeyboardShortcutManager, SyncUiEventDispatcher, SyncUiEventId, ToolButton } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("ToolButton", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", () => {
    mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" />);
  });

  it("should render active & pressed", () => {
    mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" isActive={true} isPressed={true} />);
  });

  it("renders active correctly", () => {
    FrontstageManager.setActiveToolId("tool1");
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" />).should.matchSnapshot();
  });

  it("hidden renders correctly", () => {
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" isVisible={false} />).should.matchSnapshot();
  });

  it("disabled renders correctly", () => {
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" isEnabled={false} />).should.matchSnapshot();
  });

  it("renders correctly with beta badge", () => {
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" badgeType={BadgeType.TechnicalPreview} />).should.matchSnapshot();
  });

  it("renders correctly with new badge", () => {
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" badgeType={BadgeType.New} />).should.matchSnapshot();
  });

  it("should execute a function", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" execute={spyMethod} />);
    wrapper.find(".nz-toolbar-item-item").simulate("click");
    spyMethod.should.have.been.called;
  });

  it("should execute a tool", () => {
    const wrapper = mount(<ToolButton toolId={SelectionTool.toolId} />);
    wrapper.find(".nz-toolbar-item-item").simulate("click");
  });

  it("should set focus to home on Esc", () => {
    const wrapper = mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" />);
    const element = wrapper.find(".nz-toolbar-item-item");
    element.simulate("focus");
    element.simulate("keyDown", { key: "Escape" });
    expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;
  });

  it("should use a label function", () => {
    mount(<ToolButton toolId="tool1" label={() => "test"} />);
  });

  it("sync event should trigger stateFunc", () => {
    const testEventId = "test-button-state";
    let stateFunctionCalled = false;
    const testStateFunc = (state: Readonly<BaseItemState>): BaseItemState => {
      stateFunctionCalled = true;
      return { ...state, isActive: true };
    };

    const wrapper = mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" stateSyncIds={[testEventId]} stateFunc={testStateFunc} />);
    const element = wrapper.find(".nz-toolbar-item-item");
    element.simulate("focus");
    element.simulate("keyDown", { key: "Escape" });
    expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;

    expect(stateFunctionCalled).to.eq(false);
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
    expect(stateFunctionCalled).to.eq(true);
  });

  it("ToolActivated sync event should trigger stateFunc", () => {
    const testEventId = SyncUiEventId.ToolActivated;
    let stateFunctionCalled = false;
    const testStateFunc = (state: Readonly<BaseItemState>): BaseItemState => {
      stateFunctionCalled = true;
      return { ...state, isVisible: true, isActive: true, isEnabled: true };
    };

    mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" stateSyncIds={[testEventId]} stateFunc={testStateFunc} />);

    expect(stateFunctionCalled).to.eq(false);
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
    expect(stateFunctionCalled).to.eq(true);
  });
});
