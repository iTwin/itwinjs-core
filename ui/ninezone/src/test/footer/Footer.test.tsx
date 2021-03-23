/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { Footer, SafeAreaInsets } from "../../ui-ninezone.js";
import { mount } from "../Utils.js";

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
