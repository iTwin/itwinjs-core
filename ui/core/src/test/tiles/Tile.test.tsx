/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Tile } from "../../ui-core";

describe("<Tile />", () => {
  const icon = <i className="icon icon-placeholder" />;

  it("should render", () => {
    mount(<Tile title="Test" icon={icon} />);
  });

  it("renders correctly", () => {
    shallow(<Tile title="Test" icon={icon} />).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = mount(<Tile title="Test" icon={icon} />);
    wrapper.find(".uicore-tiles-tile").length.should.eq(1);
  });

  it("has correct step className 0", () => {
    const wrapper = mount(<Tile title="Test" icon={icon} stepCount={12} />);
    wrapper.find(".uicore-step-0").length.should.eq(1);
  });

  it("has correct step className 5", () => {
    const wrapper = mount(<Tile title="Test" icon={icon} stepNum={5} stepCount={12} />);
    wrapper.find(".uicore-step-5").length.should.eq(1);
  });

  it("renders children correctly", () => {
    const wrapper = mount(<Tile title="Test" icon={icon}>This is child text</Tile>);
    wrapper.find(".uicore-children").length.should.eq(1);
  });
});
