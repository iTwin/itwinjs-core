/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { FooterIndicator } from "../../appui-layout-react";
import { mount } from "../Utils";

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

  it("renders correctly with additional class names", () => {
    shallow(<FooterIndicator className="test-class-name" />).should.matchSnapshot();
  });

  it("renders correctly with title", () => {
    shallow(<FooterIndicator title="Title test" />).should.matchSnapshot();
  });

  it("renders correctly with onClick function", () => {
    shallow(<FooterIndicator onClick={() => { }} />).should.matchSnapshot();
  });
});
