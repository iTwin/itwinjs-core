/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import Merge from "../../../src/zones/target/Merge";

describe("<Merge />", () => {
  it("should render", () => {
    mount(<Merge />);
  });

  it("renders correctly", () => {
    shallow(<Merge />).should.matchSnapshot();
  });
});
