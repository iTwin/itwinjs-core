/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import GhostOutline from "@src/zones/GhostOutline";

describe("<GhostOutline />", () => {
  it("should render", () => {
    mount(<GhostOutline />);
  });

  it("renders correctly", () => {
    shallow(<GhostOutline />).should.matchSnapshot();
  });
});
