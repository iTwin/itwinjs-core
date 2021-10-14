/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { ElementTooltip } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("ElementTooltip", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("showTooltip & hideTooltip set isTooltipVisible appropriately", () => {
    const divElement = document.createElement("div");
    mount(<ElementTooltip />);

    ElementTooltip.showTooltip(divElement, "Tooltip message", { x: 10, y: 10 });
    ElementTooltip.showTooltip(divElement, "Tooltip message 2", { x: 20, y: 20 });
    expect(ElementTooltip.isTooltipVisible).to.be.true;

    ElementTooltip.hideTooltip();
    expect(ElementTooltip.isTooltipVisible).to.be.false;
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
  });

});
