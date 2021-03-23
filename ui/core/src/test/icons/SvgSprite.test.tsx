/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import * as React from "react";
import { SvgSprite } from "../../ui-core.js";

describe("<SvgSprite />", () => {
  it("should render", () => {
    mount(<SvgSprite src="#test-sprite" />);
  });

  it("renders correctly", () => {
    shallow(<SvgSprite src="#test-sprite" />).should.matchSnapshot();
  });
});
