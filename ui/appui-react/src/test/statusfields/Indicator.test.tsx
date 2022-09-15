/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { StatusBarLabelSide } from "@itwin/appui-abstract";
import { render } from "@testing-library/react";
import { Indicator } from "../../appui-react";

describe("Indicator", () => {
  it("Should render label on left", () => {
    const wrapper = render(
      <Indicator iconSpec={"test-icon"} label="test-label" isLabelVisible={true} labelSide={StatusBarLabelSide.Left} />);
    expect(wrapper).not.to.be.undefined;
    expect(wrapper.container.querySelector(".uifw-footer-label-reversed")).to.be.null;
    expect(wrapper.container.querySelector(".icon.test-icon")).not.to.be.null;
    expect(wrapper.container.querySelector("span")).not.to.be.null;
    expect(wrapper.container.querySelector(".nz-footer-mode")).not.to.be.null;
  });

  it("Should render label on right", () => {
    const wrapper = render(
      <Indicator iconSpec={"test-icon"} label="test-label" isLabelVisible={true} labelSide={StatusBarLabelSide.Right} />);
    expect(wrapper).not.to.be.undefined;
    expect(wrapper.container.querySelector(".uifw-footer-label-reversed")).not.to.be.null;
    expect(wrapper.container.querySelector(".icon.test-icon")).not.to.be.null;
    expect(wrapper.container.querySelector("span")).not.to.be.null;
    expect(wrapper.container.querySelector(".nz-footer-mode")).not.to.be.null;
  });

  it("Should not render label", () => {
    const wrapper = render(
      <Indicator iconSpec={"test-icon"} label="test-label" isLabelVisible={false} labelSide={StatusBarLabelSide.Right} />);
    expect(wrapper).not.to.be.undefined;
    expect(wrapper.container.querySelector(".uifw-footer-label-reversed")).not.to.be.null;
    expect(wrapper.container.querySelector(".icon.test-icon")).not.to.be.null;
    expect(wrapper.container.querySelector("span")).to.be.null;
    expect(wrapper.container.querySelector(".nz-footer-mode")).not.to.be.null;
  });
});
