/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { shallow, mount } from "enzyme";
import { expect } from "chai";
import ReactResizeDetector from "react-resize-detector";
import { HorizontalAnchor, ToolSettingsWidgetMode } from "@bentley/ui-ninezone";
import { ToolSettingsContent } from "../../ui-framework/widgets/ToolSettingsContent";

describe("ToolSettingsContent", () => {
  it("should render in tab mode", () => {
    shallow(<ToolSettingsContent
      anchor={HorizontalAnchor.Left}
      mode={ToolSettingsWidgetMode.Tab}
    />);
  });

  it("should render in title bar mode", () => {
    shallow(<ToolSettingsContent
      anchor={HorizontalAnchor.Left}
      mode={ToolSettingsWidgetMode.TitleBar}
    />);
  });

  it("should get available content width on resize", async () => {
    const wrapper = mount(
      <ToolSettingsContent
        anchor={HorizontalAnchor.Left}
        mode={ToolSettingsWidgetMode.TitleBar}
      />);

    const resizeDetector = wrapper.find(ReactResizeDetector);
    expect(resizeDetector.length).to.eq(1);

    resizeDetector.prop("onResize")!(200, 200);
    wrapper.update();

    expect(wrapper.state("availableContentWidth")).to.be.eq(0); // Can't get clientRect measurement in unit test

    wrapper.unmount();
  });

});
