/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as React from "react";
import { Tooltip } from "../../ui-core/notification/Tooltip";

describe("Tooltip", () => {

  it("should render", () => {
    const wrapper = mount(<Tooltip value="Hello World!" />);
    const container = wrapper.find("div.core-tooltip-container");
    expect(container.length).to.eq(1);
    const containerStyle = container.get(0).props.style;
    expect(containerStyle).to.have.property("left", "50%");
    const tooltip = wrapper.find("div.core-tooltip");
    expect(tooltip.length).to.eq(1);
    const message = wrapper.find("span.core-tooltip-text");
    expect(message.length).to.eq(1);
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(<Tooltip value="Hello World!" />).should.matchSnapshot();
  });

  it("should render below", () => {
    const wrapper = mount(<Tooltip value="Hello World!" below />);
    const below = wrapper.find("div.core-tooltip-below");
    expect(below.length).to.eq(1);
    wrapper.unmount();
  });

  it("should render with percent", () => {
    const wrapper = mount(<Tooltip value="Hello World!" percent={75} />);
    const container = wrapper.find("div.core-tooltip-container");
    expect(container.length).to.eq(1);
    const containerStyle = container.get(0).props.style;
    expect(containerStyle).to.have.property("left", "75%");
    wrapper.unmount();
  });

});
