/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";

import {
  ToolButton,
  FrontstageManager,
} from "../../../ui-framework";
import TestUtils from "../../TestUtils";

describe("ToolButton", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render", () => {
    mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" />);
  });

  it("renders correctly", () => {
    FrontstageManager.setActiveToolId("tool1");
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" />).should.matchSnapshot();
  });

  it("hidden renders correctly", () => {
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" isVisible={false} />).should.matchSnapshot();
  });

  it("disabled renders correctly", () => {
    shallow(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" isEnabled={false} />).should.matchSnapshot();
  });

  it("should execute a function", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="UiFramework:tests.label" execute={spyMethod} />);
    wrapper.find(".nz-toolbar-item-icon").simulate("click");
    spyMethod.should.have.been.called;
    wrapper.unmount();
  });

});
