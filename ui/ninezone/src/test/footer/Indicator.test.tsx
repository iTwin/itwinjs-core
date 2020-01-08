/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
