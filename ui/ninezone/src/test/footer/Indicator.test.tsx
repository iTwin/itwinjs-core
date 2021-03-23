/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { FooterIndicator } from "../../ui-ninezone.js";
import { mount } from "../Utils.js";

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
