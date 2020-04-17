/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import TestUtils from "../TestUtils";

import { ToolWidgetComposer, BackstageAppButton } from "../../ui-framework/widgets/ToolWidgetComposer";
import { FrameworkVersion } from "../../ui-framework/hooks/useFrameworkVersion";

describe("ToolWidgetComposer", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("ToolWidgetComposer should render", () => {
    const wrapper = mount(<ToolWidgetComposer />);
    wrapper.unmount();
  });

  it("ToolWidgetComposer should render correctly", () => {
    shallow(<ToolWidgetComposer />).should.matchSnapshot();
  });

  it("ToolWidgetComposer with should render", () => {
    shallow(<ToolWidgetComposer cornerItem={<BackstageAppButton icon="icon-test" />} />).should.matchSnapshot();
  });

  it("BackstageAppButtonProps should render", () => {
    const wrapper = mount(<BackstageAppButton icon={"icon-home"} />);
    wrapper.setProps({ icon: "icon-bentley" });
    wrapper.unmount();
  });

  it("BackstageAppButtonProps should update with default icon", () => {
    const wrapper = mount(<BackstageAppButton icon={"icon-test"} />);
    wrapper.setProps({ icon: undefined });
    wrapper.unmount();
  });

  it("BackstageAppButton should render in 2.0 mode", () => {
    const wrapper = mount(
      <FrameworkVersion version="2">
        <BackstageAppButton icon={"icon-test"} />
      </FrameworkVersion>);
    wrapper.unmount();
  });

});
