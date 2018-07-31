/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Target from "@src/zones/target/Target";

describe("<Target />", () => {
  it("should render", () => {
    mount(<Target />);
  });

  it("renders correctly", () => {
    shallow(<Target />).should.matchSnapshot();
  });
});
