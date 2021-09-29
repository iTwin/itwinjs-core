/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { SvgSprite } from "../../core-react";

describe("<SvgSprite />", () => {
  it("should render", () => {
    mount(<SvgSprite src="#test-sprite" />);
  });

  it("renders correctly", () => {
    shallow(<SvgSprite src="#test-sprite" />).should.matchSnapshot();
  });
});
