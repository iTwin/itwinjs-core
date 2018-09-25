/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { mount } from "enzyme";
import TestUtils from "../TestUtils";
import { ElementTooltip } from "../../src/index";

describe("ElementTooltip", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("showTooltip & hideTooltip set isTooltipVisible appropriately", () => {
    const divElement = document.createElement("div");
    const wrapper = mount(<ElementTooltip />);
    ElementTooltip.showTooltip(divElement, "Tooltip message");
    ElementTooltip.showTooltip(divElement, "Tooltip message 2");
    expect(ElementTooltip.isTooltipVisible).to.be.true;
    ElementTooltip.hideTooltip();
    expect(ElementTooltip.isTooltipVisible).to.be.false;
    wrapper.unmount();
  });

});
