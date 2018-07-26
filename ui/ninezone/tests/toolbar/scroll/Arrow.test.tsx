/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Arrow from "@src/toolbar/scroll/Arrow";

describe("<Arrow />", () => {
  it("should render", () => {
    mount(<Arrow />);
  });

  it("renders correctly", () => {
    shallow(<Arrow />).should.matchSnapshot();
  });
});
