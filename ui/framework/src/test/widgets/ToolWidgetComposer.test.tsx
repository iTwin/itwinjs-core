/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import TestUtils from "../TestUtils";

import { ToolWidgetComposer, BackstageAppButton } from "../../ui-framework/widgets/ToolWidgetComposer";

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
  });

  it("BackstageAppButtonProps should update with default icon", () => {
    const wrapper = mount(<BackstageAppButton icon={"icon-test"} />);
    wrapper.setProps({ icon: undefined });
  });

});
