/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { Zones } from "../../ui-ninezone.js";
import { mount } from "../Utils.js";

describe("<Zones />", () => {
  it("should render", () => {
    mount(<Zones />);
  });

  it("renders correctly", () => {
    shallow(<Zones />).should.matchSnapshot();
  });

  it("renders hidden correctly", () => {
    shallow(<Zones isHidden />).should.matchSnapshot();
  });
});
