/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { FooterIndicator } from "../../ui-ninezone";

describe("<FooterIndicator />", () => {
  it("should render", () => {
    mount(<FooterIndicator />);
  });

  it("renders correctly", () => {
    shallow(<FooterIndicator />).should.matchSnapshot();
  });

  it("renders correctly in footer mode", () => {
    shallow(<FooterIndicator isInFooterMode />).should.matchSnapshot();
  });
});
