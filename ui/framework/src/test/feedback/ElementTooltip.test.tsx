/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { mount } from "enzyme";
import TestUtils from "../TestUtils";
import { ElementTooltip } from "../../ui-framework";

describe("ElementTooltip", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("showTooltip & hideTooltip set isTooltipVisible appropriately", () => {
    const divElement = document.createElement("div");
    const wrapper = mount(<ElementTooltip />);

    ElementTooltip.showTooltip(divElement, "Tooltip message", { x: 10, y: 10 });
    ElementTooltip.showTooltip(divElement, "Tooltip message 2", { x: 20, y: 20 });
    expect(ElementTooltip.isTooltipVisible).to.be.true;

    ElementTooltip.hideTooltip();
    expect(ElementTooltip.isTooltipVisible).to.be.false;

    wrapper.unmount();
  });

  it("showTooltip should support HTMLElement", () => {
    const divElement = document.createElement("div");
    const wrapper = mount(<ElementTooltip />);

    const para = document.createElement("p");                       // Create a <p> element
    const t = document.createTextNode("HTMLElement message");       // Create a text node
    para.appendChild(t);                                            // Append the text to <p>

    ElementTooltip.showTooltip(divElement, para, { x: 10, y: 10 });
    expect(ElementTooltip.isTooltipVisible).to.be.true;

    wrapper.update();
    expect(wrapper.html().indexOf("<p>HTMLElement message</p>")).to.not.eq(0);

    wrapper.unmount();
  });

});
