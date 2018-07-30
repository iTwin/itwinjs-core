/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Activity from "@src/footer/message/Activity";

describe("<Activity />", () => {
  it("should render", () => {
    mount(<Activity />);
  });

  it("renders correctly", () => {
    shallow(<Activity />).should.matchSnapshot();
  });
});
