/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Stacked from "@src/widget/Stacked";

describe("<Stacked />", () => {
  it("should render", () => {
    mount(<Stacked />);
  });

  it("renders correctly", () => {
    shallow(<Stacked />).should.matchSnapshot();
  });
});
