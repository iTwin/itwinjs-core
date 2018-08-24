/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import MouseTracker from "../../src/context/MouseTracker";

describe("<MouseTracker />", () => {
  it("should render", () => {
    mount(<MouseTracker />);
  });

  it("renders correctly", () => {
    shallow(<MouseTracker />).should.matchSnapshot();
  });
});
