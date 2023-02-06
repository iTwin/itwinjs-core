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
import { BaseItemState, SyncUiEventDispatcher, SyncUiEventId, ToolButton, UiFramework } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("ToolButton", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", () => {
    mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" />); // eslint-disable-line deprecation/deprecation
  });

  it("should render active & pressed", () => {
    mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" isActive={true} isPressed={true} />); // eslint-disable-line deprecation/deprecation
  });

  it("renders active correctly", () => {
    UiFramework.frontstages.setActiveToolId("tool1");
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" />).should.matchSnapshot(); // eslint-disable-line deprecation/deprecation
  });

  it("hidden renders correctly", () => {
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" isVisible={false} />).should.matchSnapshot(); // eslint-disable-line deprecation/deprecation
  });

  it("disabled renders correctly", () => {
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" isEnabled={false} />).should.matchSnapshot(); // eslint-disable-line deprecation/deprecation
  });

  it("renders correctly with beta badge", () => {
    // eslint-disable-next-line deprecation/deprecation
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" badgeType={BadgeType.TechnicalPreview} />).should.matchSnapshot();
  });

  it("renders correctly with new badge", () => {
    // eslint-disable-next-line deprecation/deprecation
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" badgeType={BadgeType.New} />).should.matchSnapshot();
  });

  it("should execute a function", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" execute={spyMethod} />); // eslint-disable-line deprecation/deprecation
    wrapper.find(".nz-toolbar-item-item").simulate("click");
    spyMethod.should.have.been.called;
  });

  it("should execute a tool", () => {
    const wrapper = mount(<ToolButton toolId={SelectionTool.toolId} />); // eslint-disable-line deprecation/deprecation
    wrapper.find(".nz-toolbar-item-item").simulate("click");
  });

  it("should set focus to home on Esc", () => {
    const wrapper = mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" />); // eslint-disable-line deprecation/deprecation
    const element = wrapper.find(".nz-toolbar-item-item");
    element.simulate("focus");
    element.simulate("keyDown", { key: "Escape" });
    expect(UiFramework.keyboardShortcuts.isFocusOnHome).to.be.true;
  });

  it("should use a label function", () => {
    mount(<ToolButton toolId="tool1" label={() => "test"} />); // eslint-disable-line deprecation/deprecation
  });

  it("sync event should trigger stateFunc", () => {
    const testEventId = "test-button-state";
    let stateFunctionCalled = false;
    const testStateFunc = (state: Readonly<BaseItemState>): BaseItemState => {
      stateFunctionCalled = true;
      return { ...state, isActive: true };
    };

    // eslint-disable-next-line deprecation/deprecation
    const wrapper = mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" stateSyncIds={[testEventId]} stateFunc={testStateFunc} />);
    const element = wrapper.find(".nz-toolbar-item-item");
    element.simulate("focus");
    element.simulate("keyDown", { key: "Escape" });
    expect(UiFramework.keyboardShortcuts.isFocusOnHome).to.be.true;

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

    // eslint-disable-next-line deprecation/deprecation
    mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" stateSyncIds={[testEventId]} stateFunc={testStateFunc} />);

    expect(stateFunctionCalled).to.eq(false);
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
    expect(stateFunctionCalled).to.eq(true);
  });
});
