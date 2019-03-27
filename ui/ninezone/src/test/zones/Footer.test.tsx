/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { FooterZone } from "../../ui-ninezone";

describe("<FooterZone />", () => {
  it("should render", () => {
    mount(<FooterZone bounds={{ bottom: 10, left: 0, right: 10, top: 0 }} />);
  });

  it("renders correctly", () => {
    shallow(<FooterZone bounds={{ bottom: 10, left: 0, right: 10, top: 0 }} />).should.matchSnapshot();
  });

  it("renders correctly in footer mode", () => {
    shallow(<FooterZone bounds={{ bottom: 10, left: 0, right: 10, top: 0 }} isInFooterMode />).should.matchSnapshot();
  });

  it("renders hidden correctly", () => {
    shallow(<FooterZone bounds={{ bottom: 10, left: 0, right: 10, top: 0 }} isHidden />).should.matchSnapshot();
  });
});
