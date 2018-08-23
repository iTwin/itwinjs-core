/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Columns from "../../../../../src/toolbar/item/expandable/group/Columns";

describe("<Columns />", () => {
  it("should render", () => {
    mount(<Columns />);
  });

  it("renders correctly", () => {
    shallow(<Columns />).should.matchSnapshot();
  });
});
