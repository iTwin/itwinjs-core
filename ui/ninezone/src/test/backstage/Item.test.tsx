/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { BackstageItem } from "../../ui-ninezone";

describe("<Item />", () => {
  it("should render", () => {
    mount(<BackstageItem />);
  });

  it("renders correctly", () => {
    shallow(<BackstageItem />).should.matchSnapshot();
  });

  it("should apply style", () => {
    shallow(<BackstageItem style={{ backgroundColor: "red" }} />).should.matchSnapshot();
  });

  it("should set is-active class", () => {
    shallow(<BackstageItem isActive />).should.matchSnapshot();
  });

  it("should set is-disabled class", () => {
    shallow(<BackstageItem isDisabled />).should.matchSnapshot();
  });

  it("should render subtitle", () => {
    shallow(<BackstageItem subtitle="custom subtitle" />).should.matchSnapshot();
  });
});
