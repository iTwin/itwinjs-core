/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import Zones from "@src/zones/Zones";

describe("<Zones />", () => {
  it("should render", () => {
    mount(<Zones />);
  });

  it("renders correctly", () => {
    shallow(<Zones />).should.matchSnapshot();
  });
});
