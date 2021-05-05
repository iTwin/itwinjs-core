/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import { HorizontalAnchor, ToolSettingsWidgetMode } from "@bentley/ui-ninezone";
import { ToolSettingsContent } from "../../ui-framework/widgets/ToolSettingsContent";
import { mount } from "../TestUtils";
import { ResizableContainerObserver } from "@bentley/ui-core";

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

    const resizeDetector = wrapper.find(ResizableContainerObserver);
    expect(resizeDetector.length).to.eq(1);

    resizeDetector.prop("onResize")!(200, 200);
    wrapper.update();

    expect(wrapper.state("availableContentWidth")).to.be.eq(0); // Can't get clientRect measurement in unit test
  });

});
