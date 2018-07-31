/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Overflow from "@src/toolbar/item/Overflow";

describe("<Overflow />", () => {
  it("should render", () => {
    mount(<Overflow />);
  });

  it("renders correctly", () => {
    shallow(<Overflow />).should.matchSnapshot();
  });
});
