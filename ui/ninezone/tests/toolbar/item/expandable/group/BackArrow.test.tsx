/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import BackArrow from "@src/toolbar/item/expandable/group/BackArrow";

describe("<BackArrow />", () => {
  it("should render", () => {
    mount(<BackArrow />);
  });

  it("renders correctly", () => {
    shallow(<BackArrow />).should.matchSnapshot();
  });
});
