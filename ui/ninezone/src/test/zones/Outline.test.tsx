/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Outline } from "../../ui-ninezone";

describe("<Outline />", () => {
  it("should render", () => {
    mount(<Outline bounds={{
      bottom: 0,
      left: 0,
      right: 5,
      top: 5,
    }} />);
  });

  it("renders correctly", () => {
    shallow(<Outline bounds={{
      bottom: 0,
      left: 0,
      right: 5,
      top: 5,
    }} />).should.matchSnapshot();
  });
});
