/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Footer, SafeAreaInsets } from "../../ui-ninezone";

describe("<Footer />", () => {
  it("should render", () => {
    mount(<Footer />);
  });

  it("renders correctly", () => {
    shallow(<Footer />).should.matchSnapshot();
  });

  it("renders correctly in footer mode", () => {
    shallow(<Footer isInFooterMode />).should.matchSnapshot();
  });

  it("renders safe area aware correctly", () => {
    shallow(<Footer safeAreaInsets={SafeAreaInsets.All} />).should.matchSnapshot();
  });
});
